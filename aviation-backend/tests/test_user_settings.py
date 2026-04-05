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
from app.models import settings_orm  # noqa: F401
from app.routes.auth import router as auth_router
from app.routes.settings import router as settings_router
from app.routes.users import router as users_router

TEST_DB_FILE = "./test_user_settings.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def _create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _drop_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


class TestUserSettingsEndpoints(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        asyncio.run(_create_tables())

        app = FastAPI()
        app.include_router(auth_router)
        app.include_router(users_router)
        app.include_router(settings_router)

        async def override_get_session():
            async with TestSessionLocal() as session:
                yield session

        app.dependency_overrides[get_session] = override_get_session
        cls.app = app

    @classmethod
    def tearDownClass(cls) -> None:
        asyncio.run(_drop_tables())
        asyncio.run(engine.dispose())
        if os.path.exists(TEST_DB_FILE):
            os.remove(TEST_DB_FILE)

    async def _register_and_token(self, client: AsyncClient) -> str:
        email = f"user-{uuid.uuid4().hex[:8]}@example.com"
        password = "StrongPass#2026"
        response = await client.post(
            "/api/auth/register",
            json={"email": email, "password": password},
        )
        self.assertEqual(response.status_code, 201)
        return response.json()["access_token"]

    async def test_get_and_patch_profile(self) -> None:
        async with AsyncClient(
            transport=ASGITransport(app=self.app),
            base_url="http://testserver",
        ) as client:
            token = await self._register_and_token(client)
            headers = {"Authorization": f"Bearer {token}"}

            me_response = await client.get("/api/users/me", headers=headers)
            self.assertEqual(me_response.status_code, 200)
            self.assertEqual(me_response.json()["timezone"], "UTC")

            patch_response = await client.patch(
                "/api/users/me",
                headers=headers,
                json={
                    "full_name": "John Doe",
                    "role": "Ramp Supervisor",
                    "timezone": "Asia/Colombo",
                    "contact_number": "+94 77 123 4567",
                },
            )
            self.assertEqual(patch_response.status_code, 200)
            body = patch_response.json()
            self.assertEqual(body["full_name"], "John Doe")
            self.assertEqual(body["timezone"], "Asia/Colombo")

    async def test_patch_settings_and_reset(self) -> None:
        async with AsyncClient(
            transport=ASGITransport(app=self.app),
            base_url="http://testserver",
        ) as client:
            token = await self._register_and_token(client)
            headers = {"Authorization": f"Bearer {token}"}

            patch_response = await client.patch(
                "/api/settings/me",
                headers=headers,
                json={
                    "auto_refresh_seconds": 10,
                    "default_landing_view": "turnarounds",
                    "default_airport_icao": "VCBI",
                    "preferred_units": "imperial",
                },
            )
            self.assertEqual(patch_response.status_code, 200)
            body = patch_response.json()
            self.assertEqual(body["default_airport_icao"], "VCBI")
            self.assertEqual(body["preferred_units"], "imperial")

            reset_response = await client.post("/api/settings/me/reset", headers=headers)
            self.assertEqual(reset_response.status_code, 200)
            self.assertEqual(reset_response.json()["auto_refresh_seconds"], 5)

    async def test_settings_validation_error_shape(self) -> None:
        async with AsyncClient(
            transport=ASGITransport(app=self.app),
            base_url="http://testserver",
        ) as client:
            token = await self._register_and_token(client)
            headers = {"Authorization": f"Bearer {token}"}

            bad_response = await client.patch(
                "/api/settings/me",
                headers=headers,
                json={"default_airport_icao": "abc"},
            )
            self.assertEqual(bad_response.status_code, 422)
            detail = bad_response.json()["detail"]
            self.assertIsInstance(detail, list)
            self.assertEqual(detail[0]["field"], "default_airport_icao")


if __name__ == "__main__":
    unittest.main()
