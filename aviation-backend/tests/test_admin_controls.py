from __future__ import annotations

import asyncio
import os
import unittest
import uuid

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_session
from app.models import admin_orm, auth_orm, comms_orm  # noqa: F401
from app.models.auth_orm import User
from app.models.comms_orm import CommsChannel, CommsMessage
from app.routes.admin import router as admin_router
from app.routes.auth import router as auth_router

TEST_DB_FILE = "./test_admin_controls.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def _create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _drop_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


class TestAdminControlEndpoints(unittest.IsolatedAsyncioTestCase):
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

    async def _register_user(self, client: AsyncClient, *, admin: bool = False) -> tuple[str, int, str]:
        email = f"user-{uuid.uuid4().hex[:8]}@example.com"
        password = "StrongPass#2026"

        register = await client.post("/api/auth/register", json={"email": email, "password": password})
        self.assertEqual(register.status_code, 201)

        async with TestSessionLocal() as session:
            result = await session.execute(select(User).where(User.email == email))
            user = result.scalar_one()
            if admin:
                user.is_admin = True
                user.role = "ADMIN"
                await session.commit()
            user_id = user.id

        login_path = "/api/auth/admin/login" if admin else "/api/auth/login"
        login = await client.post(login_path, json={"email": email, "password": password})
        self.assertEqual(login.status_code, 200)
        token = login.json()["access_token"]
        return token, user_id, email

    async def test_user_role_active_updates_and_audit_logs(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            admin_token, _, _ = await self._register_user(client, admin=True)
            _, target_user_id, target_email = await self._register_user(client, admin=False)
            headers = {"Authorization": f"Bearer {admin_token}"}

            role_update = await client.patch(
                f"/api/admin/users/{target_user_id}/role",
                json={"role": "OPERATOR"},
                headers=headers,
            )
            self.assertEqual(role_update.status_code, 200)
            role_body = role_update.json()
            self.assertEqual(role_body["email"], target_email)
            self.assertEqual(role_body["role"], "OPERATOR")
            self.assertFalse(role_body["is_admin"])
            self.assertTrue(role_body["is_active"])

            active_update = await client.patch(
                f"/api/admin/users/{target_user_id}/active",
                json={"is_active": False},
                headers=headers,
            )
            self.assertEqual(active_update.status_code, 200)
            active_body = active_update.json()
            self.assertEqual(active_body["email"], target_email)
            self.assertFalse(active_body["is_active"])

            logs = await client.get("/api/admin/audit-logs?limit=30&offset=0", headers=headers)
            self.assertEqual(logs.status_code, 200)
            log_items = logs.json()["items"]
            self.assertGreaterEqual(len(log_items), 2)
            actions = {item["action"] for item in log_items}
            self.assertIn("ROLE_UPDATE", actions)
            self.assertIn("ACTIVE_UPDATE", actions)

    async def test_incidents_resolve_and_system_metrics(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            admin_token, _, admin_email = await self._register_user(client, admin=True)
            headers = {"Authorization": f"Bearer {admin_token}"}

            async with TestSessionLocal() as session:
                existing_channel = await session.get(CommsChannel, "OPS")
                if existing_channel is None:
                    session.add(CommsChannel(channel_id="OPS", label="Ops", frequency_mhz=121.9, health="ONLINE"))
                session.add(
                    CommsMessage(
                        id=f"msg-{uuid.uuid4().hex[:8]}",
                        channel_id="OPS",
                        source="System",
                        message="Ground comm latency spike",
                        priority="CRITICAL",
                        requires_ack=True,
                        acknowledged=False,
                    )
                )
                await session.commit()

            incidents = await client.get("/api/admin/incidents?status=open,investigating&limit=20", headers=headers)
            self.assertEqual(incidents.status_code, 200)
            incident_items = incidents.json()["items"]
            self.assertGreaterEqual(len(incident_items), 1)

            incident_id = incident_items[0]["id"]
            self.assertIn("status", incident_items[0])
            self.assertIn(incident_items[0]["status"], {"OPEN", "INVESTIGATING"})

            resolved = await client.post(f"/api/admin/incidents/{incident_id}/resolve", headers=headers)
            self.assertEqual(resolved.status_code, 200)
            resolved_body = resolved.json()
            self.assertEqual(resolved_body["id"], incident_id)
            self.assertEqual(resolved_body["status"], "RESOLVED")
            self.assertEqual(resolved_body["resolved_by"], admin_email)
            self.assertIn("resolved_at", resolved_body)

            metrics = await client.get("/api/admin/system/metrics", headers=headers)
            self.assertEqual(metrics.status_code, 200)
            metric_items = metrics.json()["items"]
            self.assertGreaterEqual(len(metric_items), 2)
            metric_ids = {item["id"] for item in metric_items}
            self.assertIn("latency", metric_ids)
            self.assertIn("error-rate", metric_ids)

    async def test_non_admin_blocked_for_admin_control_endpoints(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            user_token, _, _ = await self._register_user(client, admin=False)
            headers = {"Authorization": f"Bearer {user_token}"}

            metrics = await client.get("/api/admin/system/metrics", headers=headers)
            logs = await client.get("/api/admin/audit-logs", headers=headers)

            self.assertEqual(metrics.status_code, 403)
            self.assertEqual(logs.status_code, 403)


if __name__ == "__main__":
    unittest.main()
