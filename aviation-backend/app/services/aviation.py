"""
Pillar 2 — Aviation Logic (The Brain)
Geofencing, Status Mapper, METAR Decoder.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import List

import httpx
from geopy.distance import geodesic

from app.config import (
    APPROACHING_DISTANCE_KM,
    AVWX_METAR_URL,
    BASE_AIRPORT_LAT,
    BASE_AIRPORT_LNG,
    DESCENDING_ALTITUDE_FT,
)
from app.models.schemas import FlightData, FlightStatus, METARResponse
from app.services.alerts import evaluate_geofence
from app.services.turnaround import initiate_turnaround
from app.database import async_session

logger = logging.getLogger("skyops.aviation")


# ─── Geofencing ──────────────────────────────────────────────────────
def distance_to_base(lat: float, lng: float) -> float:
    """Return distance in km from a point to the base airport."""
    return geodesic((lat, lng), (BASE_AIRPORT_LAT, BASE_AIRPORT_LNG)).km


# ─── Status Mapper ───────────────────────────────────────────────────
async def apply_aviation_rules(flights: List[FlightData]) -> List[FlightData]:
    """
    Enrich every flight with geofence-aware status:
      • DESCENDING  if altitude < 10 000 ft
      • APPROACHING if distance to base < 20 km
      • ON_GROUND   if altitude ≈ 0
    Also computes distance_to_airport, evaluates the 5 km alert zone,
    and auto-initiates turnaround scheduling for APPROACHING flights.
    """
    enriched: List[FlightData] = []
    approaching_ids: List[str] = []

    for f in flights:
        dist_km = distance_to_base(f.lat, f.lng)

        if f.altitude < 50:
            status = FlightStatus.ON_GROUND
        elif dist_km < APPROACHING_DISTANCE_KM:
            status = FlightStatus.APPROACHING
        elif f.altitude < DESCENDING_ALTITUDE_FT:
            status = FlightStatus.DESCENDING
        else:
            status = f.status  # keep whatever the ingestion set

        if status == FlightStatus.APPROACHING:
            approaching_ids.append(f.flightId)

        # estimate progress as inverse of distance (capped 0-100)
        progress = max(0.0, min(100.0, round(100 - (dist_km / 50) * 100, 1)))

        enriched.append(f.model_copy(update={
            "status": status,
            "progress": progress,
            "distance_to_airport": round(dist_km, 2),
        }))

    # Run the 5 km geofence evaluation on the enriched list
    evaluate_geofence(enriched)

    # Auto-initiate turnaround for APPROACHING flights
    if approaching_ids:
        try:
            async with async_session() as session:
                for fid in approaching_ids:
                    await initiate_turnaround(fid, session)
        except Exception as exc:
            logger.warning("Turnaround auto-schedule failed: %s", exc)

    return enriched


# ─── METAR Decoder ───────────────────────────────────────────────────
_CLOUD_MAP = {
    "SKC": "Clear Skies",
    "CLR": "Clear Skies",
    "FEW": "Few Clouds",
    "SCT": "Scattered Clouds",
    "BKN": "Broken Clouds",
    "OVC": "Overcast",
}


def _decode_metar_raw(raw: str) -> str:
    """
    Best-effort decode of a raw METAR string into a human-friendly summary.
    Example output: 'KJFK: Winds 10kts, Visibility 10SM, Clear Skies'
    """
    parts = raw.strip().split()
    if not parts:
        return "Unable to decode"

    station = parts[0]
    wind_str = "Calm"
    vis_str = "N/A"
    sky_str = "Unknown"

    for p in parts:
        # Wind: e.g. 21010KT or VRB05KT
        wind_match = re.match(r"(\d{3}|VRB)(\d{2,3})(G\d{2,3})?KT", p)
        if wind_match:
            speed = wind_match.group(2)
            gust = wind_match.group(3)
            wind_str = f"{speed}kts"
            if gust:
                wind_str += f" gusting {gust[1:]}kts"
            continue

        # Visibility: e.g. 10SM, 3SM, 1/2SM
        vis_match = re.match(r"(\d+/?\.?\d*)SM", p)
        if vis_match:
            vis_str = f"{vis_match.group(1)}SM"
            continue

        # Cloud cover
        for code, label in _CLOUD_MAP.items():
            if p.startswith(code):
                sky_str = label
                break

    return f"{station}: Winds {wind_str}, Visibility {vis_str}, {sky_str}"


async def fetch_metar(icao: str) -> METARResponse:
    """
    Fetch raw METAR from Aviation Weather Center and return a decoded response.
    Falls back to a friendly error message on failure.
    """
    icao = icao.upper().strip()
    url = AVWX_METAR_URL
    params = {"ids": icao, "format": "raw", "taf": "false"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            raw_text = resp.text.strip()
            if not raw_text:
                raise ValueError("Empty METAR response")
    except Exception as exc:
        logger.warning("METAR fetch failed for %s: %s", icao, exc)
        raw_text = f"{icao} DATA UNAVAILABLE"

    decoded = _decode_metar_raw(raw_text)

    return METARResponse(
        icao=icao,
        raw=raw_text,
        decoded=decoded,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
