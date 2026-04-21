"""
Weather integration routes.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.weather_schemas import RouteCenter, WindyEmbedResponse
from app.routes.auth import get_current_user
from app.services.opensky import get_current_flights
from app.services.replay import replay_service
from app.services.weather import (
    InMemoryRateLimiter,
    WindyParams,
    build_windy_embed_url,
    calculate_route_center,
    validate_layer,
)
from app.services.weather_config import WeatherConfig, get_weather_config

router = APIRouter(prefix="/api/weather", tags=["weather"])
_bearer_scheme = HTTPBearer(auto_error=False)


_weather_config = get_weather_config()
_weather_rate_limiter = InMemoryRateLimiter(_weather_config.windy_rate_limit_per_minute)


def get_windy_rate_limiter() -> InMemoryRateLimiter:
    return _weather_rate_limiter


def get_windy_runtime_config() -> WeatherConfig:
    return _weather_config


async def enforce_windy_rate_limit(
    request: Request,
    limiter: InMemoryRateLimiter = Depends(get_windy_rate_limiter),
) -> None:
    client_ip = request.client.host if request.client and request.client.host else "unknown"
    await limiter.check(client_ip)


async def optional_weather_auth(
    config: WeatherConfig = Depends(get_windy_runtime_config),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    if not config.windy_require_auth:
        return None

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing bearer token")

    return await get_current_user(credentials=credentials, session=session)


@router.get("/windy", response_model=WindyEmbedResponse)
async def get_windy_embed(
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    zoom: int | None = Query(default=None, ge=1, le=12),
    layer: str = Query(default="wind"),
    flightId: str | None = Query(default=None, min_length=1, max_length=64),
    _rate_limited: None = Depends(enforce_windy_rate_limit),
    _auth_user=Depends(optional_weather_auth),
    config: WeatherConfig = Depends(get_windy_runtime_config),
):
    selected_layer = validate_layer(layer)
    selected_zoom = zoom if zoom is not None else config.windy_default_zoom

    resolved_from = "query"
    center: RouteCenter | None = None

    if flightId:
        live_flight = next(
            (
                flight
                for flight in get_current_flights()
                if flight.flightId.strip().upper() == flightId.strip().upper()
            ),
            None,
        )
        route = await replay_service.get_flight_route(flightId, current_flight=live_flight)
        if route is None:
            raise HTTPException(status_code=404, detail=f"No route found for flight '{flightId}'")

        points = route.full_route_points or route.points
        center_lat, center_lon = calculate_route_center(points)
        lat = center_lat
        lon = center_lon
        resolved_from = "flightRoute"
        center = RouteCenter(lat=lat, lon=lon)

    if lat is None or lon is None:
        raise HTTPException(status_code=422, detail="Provide lat/lon or flightId")

    windy_url = build_windy_embed_url(
        base_url=config.windy_embed_base_url,
        params=WindyParams(lat=lat, lon=lon, zoom=selected_zoom, layer=selected_layer),
        api_key=config.windy_api_key,
    )

    return WindyEmbedResponse(
        embedUrl=windy_url,
        center=center,
        resolvedFrom=resolved_from,
    )
