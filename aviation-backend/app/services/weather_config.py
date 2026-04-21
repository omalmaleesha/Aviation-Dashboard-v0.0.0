"""
Weather integration configuration.
Acts as a single source of truth for Windy embed and security toggles.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.config import (
    WINDY_API_KEY,
    WINDY_EMBED_BASE_URL,
    WEATHER_WINDY_DEFAULT_ZOOM,
    WEATHER_WINDY_RATE_LIMIT_PER_MINUTE,
    WEATHER_WINDY_REQUIRE_AUTH,
)


@dataclass(frozen=True)
class WeatherConfig:
    windy_embed_base_url: str
    windy_api_key: str | None
    windy_require_auth: bool
    windy_rate_limit_per_minute: int
    windy_default_zoom: int


def get_weather_config() -> WeatherConfig:
    api_key = WINDY_API_KEY.strip() if WINDY_API_KEY else ""
    return WeatherConfig(
        windy_embed_base_url=WINDY_EMBED_BASE_URL,
        windy_api_key=api_key or None,
        windy_require_auth=WEATHER_WINDY_REQUIRE_AUTH,
        windy_rate_limit_per_minute=max(1, WEATHER_WINDY_RATE_LIMIT_PER_MINUTE),
        windy_default_zoom=WEATHER_WINDY_DEFAULT_ZOOM,
    )
