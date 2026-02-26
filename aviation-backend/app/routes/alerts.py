"""
Geofence alert endpoints:
  GET  /api/alerts      — recent alert history
  WS   /ws/alerts       — real-time alert stream
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.models.schemas import GeofenceAlert
from app.services.alerts import get_alert_history
from app.services.alert_ws import alert_manager

logger = logging.getLogger("skyops.alerts.route")

router = APIRouter(tags=["alerts"])


# ─── REST: recent alert history ──────────────────────────────────────
@router.get("/api/alerts", response_model=List[GeofenceAlert])
async def list_alerts():
    """Return the last 100 geofence alerts (newest first)."""
    return get_alert_history()


# ─── WebSocket: real-time alert stream ───────────────────────────────
@router.websocket("/ws/alerts")
async def ws_alerts(ws: WebSocket):
    await alert_manager.connect(ws)
    try:
        # Send recent history immediately on connect
        history = get_alert_history()[:20]  # last 20
        if history:
            await ws.send_text(json.dumps([a.model_dump() for a in history], default=str))

        while True:
            await asyncio.sleep(60)
    except WebSocketDisconnect:
        alert_manager.disconnect(ws)
    except Exception as exc:
        logger.debug("Alert WS closed unexpectedly: %s", exc)
        alert_manager.disconnect(ws)
