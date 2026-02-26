"""
METAR weather endpoint.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.models.schemas import METARResponse
from app.services.aviation import fetch_metar

router = APIRouter(tags=["weather"])


@router.get("/api/metar/{icao}", response_model=METARResponse)
async def get_metar(icao: str):
    """
    Fetch and decode a METAR for the given ICAO station.
    Example: GET /api/metar/KJFK
    → { icao: 'KJFK', raw: '...', decoded: 'KJFK: Winds 10kts, Visibility 10SM, Clear Skies', ... }
    """
    return await fetch_metar(icao)
