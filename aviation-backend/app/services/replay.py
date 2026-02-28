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

from app.config import REPLAY_BUFFER_MAXLEN, REPLAY_BUFFER_MINUTES
from app.models.schemas import (
    FlightData,
    FlightSnapshot,
    ReplayKeyframesResponse,
    ReplaySnapshotResponse,
    TimeKeyframe,
)

logger = logging.getLogger("skyops.replay")


# ─── Internal snapshot type stored in the deque ──────────────────────
# Tuple[iso_timestamp: str, flights: List[dict]]
# Using plain dicts internally avoids repeated Pydantic validation on writes.
SnapshotEntry = Tuple[str, List[Dict]]


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

    # ── Diagnostics ──────────────────────────────────────────────────

    @property
    def buffer_size(self) -> int:
        return len(self._buffer)

    @property
    def buffer_capacity(self) -> int:
        return self._buffer.maxlen or 0


# ─── Module-level singleton ──────────────────────────────────────────
replay_service = BlackBoxReplayService()
