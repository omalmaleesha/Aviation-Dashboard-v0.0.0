"""
REST + WebSocket routes for flight data.
"""

from __future__ import annotations

import json
import logging
import asyncio
from typing import List

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.models.schemas import FlightData, FlightRouteResponse
from app.services.aviation import apply_aviation_rules
from app.services.opensky import get_current_flights
from app.services.replay import replay_service
from app.services.websocket import manager

logger = logging.getLogger("skyops.ws")

router = APIRouter(tags=["flights"])


# ─── REST: snapshot of current flights ───────────────────────────────
@router.get("/api/flights", response_model=List[FlightData])
async def list_flights():
    """Return enriched flight list (one-shot, non-streaming)."""
    return await apply_aviation_rules(get_current_flights())


@router.get("/api/flights/{flight_id}/route", response_model=FlightRouteResponse)
async def get_flight_route(
    flight_id: str,
    min_points: int = Query(
        default=2,
        ge=2,
        le=500,
        description="Minimum number of points required to treat route line as drawable",
    ),
):
    """Return route polyline points for a selected flight from replay history."""
    live_flight = next(
        (
            f
            for f in get_current_flights()
            if f.flightId.strip().upper() == flight_id.strip().upper()
        ),
        None,
    )

    route = await replay_service.get_flight_route(flight_id, current_flight=live_flight)
    if route is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No route history found for flight '{flight_id}'. "
                "Wait for more snapshots or verify the selected flight id."
            ),
        )

    if route.point_count < min_points:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Route for flight '{flight_id}' has only {route.point_count} point(s); "
                f"at least {min_points} are needed to draw a line."
            ),
        )

    return route


# ─── WebSocket: real-time stream ─────────────────────────────────────
@router.websocket("/ws/flights")
async def ws_flights(ws: WebSocket):
    await manager.connect(ws)
    try:
        # Send immediate snapshot (chunked to handle 1 000+ flights)
        raw = get_current_flights()
        enriched = await apply_aviation_rules(raw)
        flight_dicts = [f.model_dump() for f in enriched]
        await manager.send_chunked(ws, flight_dicts)

        # Just keep connection open — broadcast loop pushes updates
        while True:
            await asyncio.sleep(60)

    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as exc:
        logger.debug("WebSocket closed unexpectedly: %s", exc)
        manager.disconnect(ws)
