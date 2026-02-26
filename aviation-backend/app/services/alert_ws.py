"""
Alert-specific WebSocket manager.
Broadcasts geofence alerts to connected clients whenever new alerts fire.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import List

from fastapi import WebSocket

from app.config import WEBSOCKET_BROADCAST_INTERVAL
from app.services.alerts import get_pending_alerts

logger = logging.getLogger("skyops.alerts.ws")


class AlertConnectionManager:
    """Manages /ws/alerts connections and pushes new geofence alerts."""

    def __init__(self) -> None:
        self._active: List[WebSocket] = []
        self._running: bool = False

    @property
    def client_count(self) -> int:
        return len(self._active)

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._active.append(ws)
        logger.info("Alert client connected (%d total)", self.client_count)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._active:
            self._active.remove(ws)
        logger.info("Alert client disconnected (%d remaining)", self.client_count)

    async def _broadcast(self, payload: str) -> None:
        stale: List[WebSocket] = []
        for ws in self._active:
            try:
                await ws.send_text(payload)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)

    async def start_broadcast_loop(self) -> None:
        """Check for pending alerts every broadcast tick and push them out."""
        self._running = True
        logger.info("Alert broadcast loop started")
        while self._running:
            if self._active:
                pending = get_pending_alerts()
                if pending:
                    payload = json.dumps(
                        [a.model_dump() for a in pending], default=str
                    )
                    await self._broadcast(payload)
                    logger.info("Broadcast %d alerts to %d clients", len(pending), self.client_count)
            await asyncio.sleep(WEBSOCKET_BROADCAST_INTERVAL)

    async def stop_broadcast_loop(self) -> None:
        self._running = False
        for ws in list(self._active):
            try:
                await ws.close()
            except Exception:
                pass
        self._active.clear()
        logger.info("Alert broadcast loop stopped")


# Singleton
alert_manager = AlertConnectionManager()
