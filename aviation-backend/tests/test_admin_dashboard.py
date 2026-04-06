from __future__ import annotations

import asyncio
import os
import unittest
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_session
from app.models import auth_orm, comms_orm  # noqa: F401
from app.models.auth_orm import User
from app.models.comms_orm import CommsChannel, CommsMessage
from app.routes.admin import router as admin_router
from app.routes.auth import router as auth_router

TEST_DB_FILE = "./test_admin_dashboard.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def _create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _drop_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


class TestAdminDashboardEndpoints(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        asyncio.run(_create_tables())

        app = FastAPI()
        app.include_router(auth_router)
        app.include_router(admin_router)

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

    async def _register_and_login(self, client: AsyncClient, *, admin: bool) -> str:
        email = f"user-{uuid.uuid4().hex[:8]}@example.com"
        password = "StrongPass#2026"

        register = await client.post("/api/auth/register", json={"email": email, "password": password})
        self.assertEqual(register.status_code, 201)

        if admin:
            async with TestSessionLocal() as session:
                result = await session.execute(select(User).where(User.email == email))
                user = result.scalar_one()
                user.is_admin = True
                user.role = "ADMIN"
                await session.commit()

            login = await client.post("/api/auth/admin/login", json={"email": email, "password": password})
            self.assertEqual(login.status_code, 200)
            return login.json()["access_token"]

        login = await client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(login.status_code, 200)
        return login.json()["access_token"]

    async def test_admin_overview_returns_expected_shape(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            token = await self._register_and_login(client, admin=True)

            # Seed comms data to exercise open incident / unresolved alert counts.
            async with TestSessionLocal() as session:
                channel = CommsChannel(channel_id="OPS", label="Ops", frequency_mhz=121.9, health="ONLINE")
                session.add(channel)
                session.add_all(
                    [
                        CommsMessage(
                            id=f"msg-{uuid.uuid4().hex[:8]}",
                            channel_id="OPS",
                            source="System",
                            message="Ack required",
                            priority="HIGH",
                            requires_ack=True,
                            acknowledged=False,
                        ),
                        CommsMessage(
                            id=f"msg-{uuid.uuid4().hex[:8]}",
                            channel_id="OPS",
                            source="System",
                            message="Critical incident",
                            priority="CRITICAL",
                            requires_ack=False,
                            acknowledged=False,
                        ),
                    ]
                )
                await session.commit()

            response = await client.get("/api/admin/overview", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(response.status_code, 200)
            body = response.json()

            self.assertIn("overview", body)
            overview = body["overview"]
            self.assertIn("total_users", overview)
            self.assertIn("active_sessions", overview)
            self.assertIn("open_incidents", overview)
            self.assertIn("unresolved_alerts", overview)
            self.assertIn("system_health_score", overview)
            self.assertGreaterEqual(overview["system_health_score"], 60)
            self.assertLessEqual(overview["system_health_score"], 100)
            self.assertGreaterEqual(overview["open_incidents"], 1)
            self.assertGreaterEqual(overview["unresolved_alerts"], 1)

    async def test_admin_users_supports_pagination(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            token = await self._register_and_login(client, admin=True)
            await self._register_and_login(client, admin=False)

            response = await client.get(
                "/api/admin/users?limit=1&offset=0",
                headers={"Authorization": f"Bearer {token}"},
            )
            self.assertEqual(response.status_code, 200)
            body = response.json()

            self.assertEqual(body["limit"], 1)
            self.assertEqual(body["offset"], 0)
            self.assertGreaterEqual(body["total"], 2)
            self.assertEqual(len(body["items"]), 1)

            user = body["items"][0]
            self.assertIn("id", user)
            self.assertIn("email", user)
            self.assertIn("role", user)
            self.assertIn("is_admin", user)
            self.assertIn("is_active", user)
            self.assertIn("is_test_user", user)
            self.assertIn("created_at", user)
            self.assertIn("last_login_at", user)

    async def test_non_admin_forbidden_for_dashboard_endpoints(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            token = await self._register_and_login(client, admin=False)
            headers = {"Authorization": f"Bearer {token}"}

            overview = await client.get("/api/admin/overview", headers=headers)
            users = await client.get("/api/admin/users", headers=headers)

            self.assertEqual(overview.status_code, 403)
            self.assertEqual(users.status_code, 403)


if __name__ == "__main__":
    unittest.main()
