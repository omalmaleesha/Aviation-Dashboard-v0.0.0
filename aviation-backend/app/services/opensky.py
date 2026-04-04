"""
Pillar 1 — Data Ingestion (The Pilot)
Async service that polls OpenSky Network every 60 s.
Falls back to synthetic data when the API is unreachable.
Designed to handle 1 000+ flights efficiently.
"""

from __future__ import annotations

import asyncio
import logging
import random
import string
import time
from datetime import datetime, timezone
from typing import List

import httpx

from app.config import (
    ACTIVE_BOUNDING_BOX,
    MAX_SYNTHETIC_FLIGHTS,
    OPENSKY_API_URL,
    OPENSKY_POLL_INTERVAL,
)
from app.models.schemas import FlightData, FlightStatus
from app.services.aircraft import infer_aircraft_type
from app.services.airports import infer_origin_destination
from app.services.replay import replay_service

logger = logging.getLogger("skyops.opensky")

# ─── Module-level state ──────────────────────────────────────────────
_current_flights: List[FlightData] = []
_opensky_connected: bool = False
_last_poll_utc: str | None = None
_running: bool = False


# ─── Public Accessors ────────────────────────────────────────────────
def get_current_flights() -> List[FlightData]:
    return list(_current_flights)


def is_connected() -> bool:
    return _opensky_connected


def last_poll() -> str | None:
    return _last_poll_utc


# ─── Synthetic Flight Generator (fallback) ──────────────────────────
_AIRPORTS = [
    "VDPP", "VDSR", "WSSS", "VTBS", "WMKK", "RPLL", "WIII",
    "VHHH", "RJTT", "RKSI", "VIDP", "VOMM", "VCBI", "VRMM",
    "ZPPP", "VTSB", "VTSP", "RPVM", "WADD", "VYYY",
]


def _random_callsign() -> str:
    prefix = random.choice([
        "CPA", "SIA", "THA", "MAS", "PAL", "CES", "CSN", "CCA",
        "ANA", "JAL", "KAL", "AAR", "VJC", "ALK", "ULK", "AXM",
        "AIC", "IGO", "JSA", "TWB",
    ])
    number = "".join(random.choices(string.digits, k=random.randint(2, 4)))
    return f"{prefix}{number}"


def _generate_synthetic_flights() -> List[FlightData]:
    """Produce believable flight objects so the frontend is never empty."""
    bbox = ACTIVE_BOUNDING_BOX
    # Worldwide fallback if no bounding box is set
    lat_min, lat_max = (bbox[0], bbox[1]) if bbox else (-60.0, 70.0)
    lng_min, lng_max = (bbox[2], bbox[3]) if bbox else (-180.0, 180.0)
    now_iso = datetime.now(timezone.utc).isoformat()

    flights: List[FlightData] = []
    for _ in range(random.randint(800, MAX_SYNTHETIC_FLIGHTS)):
        callsign = _random_callsign()
        lat = random.uniform(lat_min, lat_max)
        lng = random.uniform(lng_min, lng_max)
        altitude = random.uniform(0, 42_000)
        speed = random.uniform(120, 520)
        heading = random.uniform(0, 360)
        aircraft_type = infer_aircraft_type(
            flight_id=callsign,
            speed_kts=speed,
            altitude_ft=altitude,
        )

        status = FlightStatus.EN_ROUTE
        if altitude < 1_000:
            status = FlightStatus.ON_GROUND
        elif altitude < 10_000:
            status = FlightStatus.DESCENDING

        flights.append(
            FlightData(
                flightId=callsign,
                aircraft_type=aircraft_type,
                origin=random.choice(_AIRPORTS),
                destination=random.choice(_AIRPORTS),
                status=status,
                progress=round(random.uniform(0, 100), 1),
                altitude=round(altitude, 0),
                speed=round(speed, 1),
                lat=round(lat, 6),
                lng=round(lng, 6),
                heading=round(heading, 1),
                last_updated=now_iso,
            )
        )
    return flights


# ─── OpenSky Response Parser ────────────────────────────────────────
def _parse_opensky_states(states: list) -> List[FlightData]:
    """
    OpenSky state vector indices:
    0=icao24, 1=callsign, 2=origin_country, 5=longitude, 6=latitude,
    7=baro_altitude(m), 9=velocity(m/s), 10=true_track, 11=vertical_rate
    """
    flights: List[FlightData] = []
    now_iso = datetime.now(timezone.utc).isoformat()
    for sv in states:
        try:
            icao24: str = sv[0] or "UNKNOWN"
            callsign: str = (sv[1] or "").strip() or icao24
            lat = sv[6]
            lng = sv[5]
            if lat is None or lng is None:
                continue

            baro_alt_m = sv[7] or 0.0
            altitude_ft = baro_alt_m * 3.28084  # metres → feet
            velocity_ms = sv[9] or 0.0
            speed_kts = velocity_ms * 1.94384  # m/s → knots
            heading = sv[10] or 0.0
            aircraft_type = infer_aircraft_type(
                flight_id=callsign,
                speed_kts=float(speed_kts),
                altitude_ft=float(altitude_ft),
            )
            origin_icao, destination_icao = infer_origin_destination(
                lat=float(lat),
                lng=float(lng),
                heading_deg=float(heading),
                speed_kts=float(speed_kts),
            )

            status = FlightStatus.EN_ROUTE
            if altitude_ft < 50:
                status = FlightStatus.ON_GROUND
            elif altitude_ft < 10_000:
                status = FlightStatus.DESCENDING

            flights.append(
                FlightData(
                    flightId=callsign,
                    aircraft_type=aircraft_type,
                    origin=origin_icao,
                    destination=destination_icao,
                    status=status,
                    progress=0.0,
                    altitude=round(altitude_ft, 0),
                    speed=round(speed_kts, 1),
                    lat=round(lat, 6),
                    lng=round(lng, 6),
                    heading=round(heading % 360, 1),
                    last_updated=now_iso,
                )
            )
        except (IndexError, TypeError, ValueError) as exc:
            logger.debug("Skipping malformed state vector: %s", exc)
    return flights


# ─── Core Polling Loop ───────────────────────────────────────────────
async def start_polling() -> None:
    """Long-running task: polls OpenSky, falls back to synthetic data."""
    global _current_flights, _opensky_connected, _last_poll_utc, _running

    _running = True
    logger.info("OpenSky poller started (interval=%ds)", OPENSKY_POLL_INTERVAL)

    bbox = ACTIVE_BOUNDING_BOX
    params = {}
    if bbox is not None:
        params = {
            "lamin": bbox[0],
            "lamax": bbox[1],
            "lomin": bbox[2],
            "lomax": bbox[3],
        }
    else:
        logger.info("No bounding box set — polling WORLDWIDE flights")

    async with httpx.AsyncClient(timeout=15.0) as client:
        while _running:
            try:
                resp = await client.get(OPENSKY_API_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
                states = data.get("states") or []
                _current_flights = _parse_opensky_states(states)
                _opensky_connected = True
                logger.info("Polled %d live flights from OpenSky", len(_current_flights))
            except Exception as exc:
                logger.warning("OpenSky unavailable (%s) — using synthetic data", exc)
                _current_flights = _generate_synthetic_flights()
                _opensky_connected = False

            _last_poll_utc = datetime.now(timezone.utc).isoformat()

            # ── Black-box replay: capture snapshot ───────────────────
            await replay_service.capture_snapshot(_current_flights)

            await asyncio.sleep(OPENSKY_POLL_INTERVAL)


async def stop_polling() -> None:
    global _running
    _running = False
    logger.info("OpenSky poller stopped")
