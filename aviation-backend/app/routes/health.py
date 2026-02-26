"""
System Health endpoint — the green pulse the frontend polls.
"""

from __future__ import annotations

import time

from fastapi import APIRouter

from app.models.schemas import SystemHealth
from app.services.opensky import get_current_flights, is_connected, last_poll
from app.services.websocket import manager

router = APIRouter(tags=["system"])

_start_time: float = time.time()


@router.get("/api/health", response_model=SystemHealth)
async def health_check():
    connected = is_connected()
    flights = get_current_flights()
    return SystemHealth(
        status="HEALTHY" if connected else "DEGRADED",
        opensky_connected=connected,
        active_flights=len(flights),
        connected_clients=manager.client_count,
        uptime_seconds=round(time.time() - _start_time, 2),
        last_poll_utc=last_poll(),
    )
