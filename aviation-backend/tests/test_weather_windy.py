from __future__ import annotations

import asyncio
import os
import unittest
import uuid

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_session
from app.models import auth_orm  # noqa: F401
from app.models.schemas import FlightData, FlightStatus
from app.routes.auth import router as auth_router
from app.routes.weather import (
    get_windy_rate_limiter,
    get_windy_runtime_config,
    router as weather_router,
)
from app.services.replay import replay_service
from app.services.weather import InMemoryRateLimiter
from app.services.weather_config import WeatherConfig

TEST_DB_FILE = "./test_weather_windy.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def _create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _drop_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


class TestWindyWeatherEndpoint(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        asyncio.run(_create_tables())

        app = FastAPI()
        app.include_router(auth_router)
        app.include_router(weather_router)

        async def override_get_session():
            async with TestSessionLocal() as session:
                yield session

        app.dependency_overrides[get_session] = override_get_session
        app.dependency_overrides[get_windy_runtime_config] = lambda: WeatherConfig(
            windy_embed_base_url="https://embed.windy.com/embed2.html",
            windy_api_key=None,
            windy_require_auth=False,
            windy_rate_limit_per_minute=60,
            windy_default_zoom=6,
        )
        cls.app = app

    @classmethod
    def tearDownClass(cls) -> None:
        asyncio.run(_drop_tables())
        asyncio.run(engine.dispose())
        if os.path.exists(TEST_DB_FILE):
            os.remove(TEST_DB_FILE)

    async def test_generate_embed_url_with_query_params(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            response = await client.get("/api/weather/windy?lat=7.18&lon=79.88&layer=wind")
            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertIn("embedUrl", body)
            self.assertIn("overlay=wind", body["embedUrl"])
            self.assertIn("lat=7.180000", body["embedUrl"])
            self.assertEqual(body["resolvedFrom"], "query")

    async def test_flight_id_resolves_center(self) -> None:
        flight_id = f"FLT-{uuid.uuid4().hex[:6]}"
        await replay_service.capture_snapshot(
            [
                FlightData(
                    flightId=flight_id,
                    aircraft_type="A320",
                    origin="VCBI",
                    destination="VDSR",
                    status=FlightStatus.EN_ROUTE,
                    progress=22.0,
                    altitude=15000,
                    speed=320,
                    lat=7.0,
                    lng=79.0,
                    heading=45.0,
                    last_updated=None,
                ),
                FlightData(
                    flightId=flight_id,
                    aircraft_type="A320",
                    origin="VCBI",
                    destination="VDSR",
                    status=FlightStatus.EN_ROUTE,
                    progress=26.0,
                    altitude=16000,
                    speed=330,
                    lat=8.0,
                    lng=80.0,
                    heading=45.0,
                    last_updated=None,
                ),
            ]
        )

        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            response = await client.get(f"/api/weather/windy?flightId={flight_id}&layer=rain")
            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(body["resolvedFrom"], "flightRoute")
            self.assertIn("center", body)
            self.assertIn("overlay=rain", body["embedUrl"])

    async def test_rate_limiter_blocks_excess_requests(self) -> None:
        limiter = InMemoryRateLimiter(1)
        self.app.dependency_overrides[get_windy_rate_limiter] = lambda: limiter

        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            first = await client.get("/api/weather/windy?lat=7.1&lon=79.9")
            second = await client.get("/api/weather/windy?lat=7.2&lon=79.8")

            self.assertEqual(first.status_code, 200)
            self.assertEqual(second.status_code, 429)

        self.app.dependency_overrides.pop(get_windy_rate_limiter, None)


if __name__ == "__main__":
    unittest.main()
