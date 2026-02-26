"""
Pillar 3 — Real-Time Communication (The Link)
WebSocket manager that broadcasts enriched flight data to every
connected frontend client every 60 seconds.

Scale strategy:  Instead of blasting 1 000 flights in a single JSON
frame, the manager splits enriched flights into chunks of
BROADCAST_CHUNK_SIZE (100) and sends each chunk as a separate
WebSocket text frame with a short async yield between chunks.
This prevents network congestion on both the server and the client.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import List

from fastapi import WebSocket

from app.config import BROADCAST_CHUNK_SIZE, WEBSOCKET_BROADCAST_INTERVAL
from app.services.aviation import apply_aviation_rules
from app.services.opensky import get_current_flights

logger = logging.getLogger("skyops.websocket")


class ConnectionManager:
    """Manages WebSocket connections and chunked broadcasts."""

    def __init__(self) -> None:
        self._active: List[WebSocket] = []
        self._running: bool = False

    @property
    def client_count(self) -> int:
        return len(self._active)

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._active.append(ws)
        logger.info("Client connected (%d total)", self.client_count)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._active:
            self._active.remove(ws)
        logger.info("Client disconnected (%d remaining)", self.client_count)

    # ── low-level: send a single text payload to all clients ─────────
    async def _broadcast(self, payload: str) -> None:
        """Send to all clients, drop those that have gone away."""
        stale: List[WebSocket] = []
        for ws in self._active:
            try:
                await ws.send_text(payload)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)

    # ── chunked sender (broadcast_buffer) ────────────────────────────
    async def _broadcast_chunked(self, flights: list) -> None:
        """
        Split *flights* (list of dicts) into chunks of BROADCAST_CHUNK_SIZE
        and send each chunk as a separate WebSocket frame.

        Every chunk is a JSON object:
            { "chunk": <index>, "total_chunks": N, "total_flights": T, "flights": [...] }

        This lets the frontend reassemble or progressively render.
        """
        total = len(flights)
        total_chunks = max(1, (total + BROADCAST_CHUNK_SIZE - 1) // BROADCAST_CHUNK_SIZE)

        for idx in range(total_chunks):
            start = idx * BROADCAST_CHUNK_SIZE
            end = start + BROADCAST_CHUNK_SIZE
            chunk_payload = json.dumps(
                {
                    "chunk": idx + 1,
                    "total_chunks": total_chunks,
                    "total_flights": total,
                    "flights": flights[start:end],
                },
                default=str,
            )
            await self._broadcast(chunk_payload)
            # Yield to the event loop between chunks so other coroutines
            # (polling, fuel-analytics, HTTP requests) aren't starved.
            if idx < total_chunks - 1:
                await asyncio.sleep(0)

        logger.debug(
            "Broadcast %d flights in %d chunk(s) to %d client(s)",
            total,
            total_chunks,
            self.client_count,
        )

    # ── public helper for one-shot chunked send (used by routes) ─────
    async def send_chunked(self, ws: WebSocket, flights: list) -> None:
        """
        Send *flights* (list of dicts) to a **single** WebSocket
        connection using the same chunking protocol.
        """
        total = len(flights)
        total_chunks = max(1, (total + BROADCAST_CHUNK_SIZE - 1) // BROADCAST_CHUNK_SIZE)

        for idx in range(total_chunks):
            start = idx * BROADCAST_CHUNK_SIZE
            end = start + BROADCAST_CHUNK_SIZE
            chunk_payload = json.dumps(
                {
                    "chunk": idx + 1,
                    "total_chunks": total_chunks,
                    "total_flights": total,
                    "flights": flights[start:end],
                },
                default=str,
            )
            await ws.send_text(chunk_payload)
            if idx < total_chunks - 1:
                await asyncio.sleep(0)

    # ── main broadcast loop ──────────────────────────────────────────
    async def start_broadcast_loop(self) -> None:
        """Periodically push enriched flight data to all connected clients."""
        self._running = True
        logger.info(
            "Broadcast loop started (interval=%ds, chunk_size=%d)",
            WEBSOCKET_BROADCAST_INTERVAL,
            BROADCAST_CHUNK_SIZE,
        )
        while self._running:
            if self._active:
                raw_flights = get_current_flights()
                enriched = await apply_aviation_rules(raw_flights)
                flight_dicts = [f.model_dump() for f in enriched]
                await self._broadcast_chunked(flight_dicts)
            await asyncio.sleep(WEBSOCKET_BROADCAST_INTERVAL)

    async def stop_broadcast_loop(self) -> None:
        self._running = False
        # close remaining connections gracefully
        for ws in list(self._active):
            try:
                await ws.close()
            except Exception:
                pass
        self._active.clear()
        logger.info("Broadcast loop stopped")


# Singleton shared across the app
manager = ConnectionManager()
