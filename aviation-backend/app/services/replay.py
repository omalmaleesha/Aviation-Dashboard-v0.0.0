"""
Black Box Time-Series Replay Service
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Maintains a sliding-window buffer of the last N minutes of flight
snapshots so the frontend can "replay" historical positions.

Design decisions:
  • collections.deque(maxlen=…) auto-evicts oldest entries → zero GC pressure
  • Only essential fields (id, lat, lng, heading, status) are stored
  • An asyncio.Lock serialises writes from the poller vs. reads from the API
"""

from __future__ import annotations

import asyncio
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from geopy import Point
from geopy.distance import distance as geopy_distance

from app.config import REPLAY_BUFFER_MAXLEN, REPLAY_BUFFER_MINUTES
from app.models.schemas import (
    FlightData,
    FlightRouteResponse,
    FlightSnapshot,
    ReplayKeyframesResponse,
    ReplaySnapshotResponse,
    RoutePoint,
    TimeKeyframe,
)
from app.services.airports import get_airport_coords

logger = logging.getLogger("skyops.replay")


# ─── Internal snapshot type stored in the deque ──────────────────────
# Tuple[iso_timestamp: str, flights: List[dict]]
# Using plain dicts internally avoids repeated Pydantic validation on writes.
SnapshotEntry = Tuple[str, List[Dict]]


def _interpolate_route(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    count: int,
    base_timestamp: str,
) -> List[RoutePoint]:
    """Create evenly-spaced points between two coordinates."""
    if count <= 1:
        return [RoutePoint(lat=end_lat, lng=end_lng, timestamp=base_timestamp)]

    points: List[RoutePoint] = []
    for idx in range(1, count + 1):
        t = idx / count
        lat = start_lat + (end_lat - start_lat) * t
        lng = start_lng + (end_lng - start_lng) * t
        points.append(RoutePoint(lat=round(lat, 6), lng=round(lng, 6), timestamp=base_timestamp))
    return points


def _project_by_heading(
    lat: float,
    lng: float,
    heading_deg: float,
    speed_kts: float,
    base_timestamp: str,
    steps: int = 12,
    minutes_per_step: int = 5,
) -> List[RoutePoint]:
    """Project a likely future path from heading + speed."""
    if steps <= 0:
        return []

    # Fallback to a moderate cruise speed when unavailable.
    effective_speed = max(speed_kts, 220.0)
    distance_nm_per_step = effective_speed * (minutes_per_step / 60.0)

    points: List[RoutePoint] = []
    current = Point(latitude=lat, longitude=lng)
    for _ in range(steps):
        current = geopy_distance(nautical=distance_nm_per_step).destination(current, heading_deg)
        points.append(
            RoutePoint(
                lat=round(current.latitude, 6),
                lng=round(current.longitude, 6),
                timestamp=base_timestamp,
            )
        )
    return points


class BlackBoxReplayService:
    """Thread-safe, memory-optimised, sliding-window flight recorder."""

    def __init__(self, maxlen: int = REPLAY_BUFFER_MAXLEN) -> None:
        self._buffer: deque[SnapshotEntry] = deque(maxlen=maxlen)
        self._lock = asyncio.Lock()
        logger.info(
            "Black-box replay initialised (window=%d min, max_snapshots=%d)",
            REPLAY_BUFFER_MINUTES,
            maxlen,
        )

    # ── Write path (called by the poller) ────────────────────────────

    @staticmethod
    def _compress(flight: FlightData) -> Dict:
        """Extract only the essential fields to minimise memory footprint."""
        return {
            "id": flight.flightId,
            "lat": flight.lat,
            "lng": flight.lng,
            "heading": flight.heading,
            "status": flight.status.value,
        }

    async def capture_snapshot(self, flights: List[FlightData]) -> None:
        """Timestamp the current flight list and push it into the buffer.

        Called once per polling cycle.  The lock ensures the API reader
        never sees a half-written snapshot.
        """
        timestamp = datetime.now(timezone.utc).isoformat()
        compressed = [self._compress(f) for f in flights]
        async with self._lock:
            self._buffer.append((timestamp, compressed))
        logger.debug(
            "Snapshot captured: %s  (%d flights, buffer=%d/%d)",
            timestamp,
            len(compressed),
            len(self._buffer),
            self._buffer.maxlen,
        )

    # ── Read path (called by the API) ────────────────────────────────

    async def get_keyframes(self) -> ReplayKeyframesResponse:
        """Return metadata for every snapshot currently in the buffer."""
        async with self._lock:
            keyframes = [
                TimeKeyframe(timestamp=ts, flight_count=len(flights))
                for ts, flights in self._buffer
            ]
        return ReplayKeyframesResponse(
            buffer_window_minutes=REPLAY_BUFFER_MINUTES,
            total_keyframes=len(keyframes),
            keyframes=keyframes,
        )

    async def get_snapshot_at(
        self, requested_iso: str
    ) -> Optional[ReplaySnapshotResponse]:
        """Find the snapshot closest to *requested_iso*.

        Uses a simple linear scan (buffer ≤ 30 entries → O(30) is fine).
        Returns ``None`` if the buffer is empty.
        """
        try:
            target_dt = datetime.fromisoformat(requested_iso)
            # Ensure timezone-aware comparison
            if target_dt.tzinfo is None:
                target_dt = target_dt.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            return None

        async with self._lock:
            if not self._buffer:
                return None

            best_ts: str = ""
            best_flights: List[Dict] = []
            best_delta: float = float("inf")

            for ts, flights in self._buffer:
                snap_dt = datetime.fromisoformat(ts)
                delta = abs((snap_dt - target_dt).total_seconds())
                if delta < best_delta:
                    best_delta = delta
                    best_ts = ts
                    best_flights = flights

        # Build Pydantic response outside the lock (no mutation)
        flight_models = [FlightSnapshot(**f) for f in best_flights]
        return ReplaySnapshotResponse(
            timestamp=best_ts,
            requested_timestamp=requested_iso,
            delta_seconds=round(best_delta, 3),
            flight_count=len(flight_models),
            flights=flight_models,
        )

    async def get_flight_route(
        self,
        flight_id: str,
        current_flight: Optional[FlightData] = None,
    ) -> Optional[FlightRouteResponse]:
        """Build a route polyline for one flight from buffered snapshots.

        Returns ``None`` when the flight is not present in the replay buffer.
        """
        needle = flight_id.strip().upper()
        if not needle:
            return None

        async with self._lock:
            if not self._buffer:
                return None

            sampled_from_keyframes = len(self._buffer)
            points: List[RoutePoint] = []
            previous_lat: float | None = None
            previous_lng: float | None = None

            for ts, flights in self._buffer:
                match = next(
                    (
                        f
                        for f in flights
                        if str(f.get("id", "")).strip().upper() == needle
                    ),
                    None,
                )
                if match is None:
                    continue

                lat = float(match["lat"])
                lng = float(match["lng"])

                # Avoid duplicate consecutive coordinates to keep polylines light.
                if previous_lat == lat and previous_lng == lng:
                    continue

                points.append(RoutePoint(lat=lat, lng=lng, timestamp=ts))
                previous_lat = lat
                previous_lng = lng

        if not points:
            return None

        current_point = points[-1]
        if current_flight is not None:
            current_point = RoutePoint(
                lat=current_flight.lat,
                lng=current_flight.lng,
                timestamp=current_flight.last_updated or points[-1].timestamp,
            )

        projected_points: List[RoutePoint] = []
        route_source = "HISTORY_ONLY"

        origin_icao = current_flight.origin if current_flight is not None else None
        destination_icao = current_flight.destination if current_flight is not None else None
        destination_coords = get_airport_coords(destination_icao)

        if destination_coords is not None:
            projected_points = _interpolate_route(
                start_lat=current_point.lat,
                start_lng=current_point.lng,
                end_lat=destination_coords[0],
                end_lng=destination_coords[1],
                count=12,
                base_timestamp=current_point.timestamp,
            )
            route_source = "DESTINATION_AIRPORT"
        elif current_flight is not None:
            projected_points = _project_by_heading(
                lat=current_point.lat,
                lng=current_point.lng,
                heading_deg=current_flight.heading,
                speed_kts=current_flight.speed,
                base_timestamp=current_point.timestamp,
            )
            if projected_points:
                route_source = "HEADING_PROJECTION"

        full_route_points = [*points, *projected_points]
        end_point = projected_points[-1] if projected_points else points[-1]

        return FlightRouteResponse(
            flight_id=flight_id,
            points=points,
            projected_points=projected_points,
            full_route_points=full_route_points,
            start_point=points[0],
            current_point=current_point,
            end_point=end_point,
            origin_icao=origin_icao,
            destination_icao=destination_icao,
            route_source=route_source,
            point_count=len(points),
            start_timestamp=points[0].timestamp,
            end_timestamp=points[-1].timestamp,
            sampled_from_keyframes=sampled_from_keyframes,
        )

    # ── Diagnostics ──────────────────────────────────────────────────

    @property
    def buffer_size(self) -> int:
        return len(self._buffer)

    @property
    def buffer_capacity(self) -> int:
        return self._buffer.maxlen or 0


# ─── Module-level singleton ──────────────────────────────────────────
replay_service = BlackBoxReplayService()
