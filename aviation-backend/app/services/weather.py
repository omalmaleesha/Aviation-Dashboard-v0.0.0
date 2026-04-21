"""
Weather integration service.
Provides Windy embed URL generation and small extension hooks for future features.
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from urllib.parse import urlencode

from fastapi import HTTPException

from app.models.schemas import FlightData

_ALLOWED_LAYERS = {"wind", "rain", "clouds", "pressure"}


class InMemoryRateLimiter:
    """Simple in-memory fixed-window limiter per key (IP).

    Lightweight and suitable for single-instance deployment.
    Replace with Redis or API gateway limits for distributed setups.
    """

    def __init__(self, limit_per_minute: int, *, window_seconds: int = 60) -> None:
        self._limit = max(1, int(limit_per_minute))
        self._window_seconds = max(1, int(window_seconds))
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, key: str) -> None:
        now = time.time()
        floor = now - self._window_seconds

        async with self._lock:
            bucket = self._events[key]
            while bucket and bucket[0] <= floor:
                bucket.popleft()

            if len(bucket) >= self._limit:
                raise HTTPException(status_code=429, detail="Rate limit exceeded")

            bucket.append(now)


@dataclass(frozen=True)
class WindyParams:
    lat: float
    lon: float
    zoom: int
    layer: str


def validate_layer(layer: str) -> str:
    normalized = (layer or "").strip().lower()
    if normalized not in _ALLOWED_LAYERS:
        allowed = ", ".join(sorted(_ALLOWED_LAYERS))
        raise HTTPException(status_code=422, detail=f"Unsupported layer '{layer}'. Allowed: {allowed}")
    return normalized


def build_windy_embed_url(*, base_url: str, params: WindyParams, api_key: str | None = None) -> str:
    query = {
        "lat": f"{params.lat:.6f}",
        "lon": f"{params.lon:.6f}",
        "zoom": str(params.zoom),
        "overlay": params.layer,
        "menu": "",
        "message": "",
        "marker": "",
        "calendar": "now",
    }
    if api_key:
        query["apiKey"] = api_key
    return f"{base_url}?{urlencode(query)}"


def calculate_route_center(route_points: list) -> tuple[float, float]:
    if not route_points:
        raise HTTPException(status_code=404, detail="Flight route has no points")

    lat_sum = 0.0
    lon_sum = 0.0
    for point in route_points:
        lat_sum += float(point.lat)
        lon_sum += float(point.lng)

    n = float(len(route_points))
    return (lat_sum / n, lon_sum / n)


class WeatherAlertEngine:
    """Future extension hook for weather-alert generation."""

    async def evaluate(self, flight: FlightData) -> list[dict]:
        # Placeholder for future implementation.
        return []


class WeatherImpactAnalyzer:
    """Future extension hook for AI-based weather impact analysis."""

    async def analyze(self, *, flight: FlightData, layer: str) -> dict:
        # Placeholder for future implementation.
        return {
            "impactScore": None,
            "summary": "AI weather impact analysis not enabled yet",
            "layer": layer,
        }
