from __future__ import annotations

import asyncio
import os
import unittest
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_session
from app.models import audit_orm  # noqa: F401
from app.models import auth_orm  # noqa: F401
from app.models import comms_orm  # noqa: F401
from app.models import settings_orm  # noqa: F401
from app.models.comms_orm import CommsChannel, CommsMessage
from app.routes.audit import router as audit_router
from app.routes.auth import router as auth_router
from app.routes.comms import router as comms_router
from app.routes.settings import router as settings_router

TEST_DB_FILE = "./test_audit.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def _create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _drop_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


class TestAuditTimeline(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        asyncio.run(_create_tables())

        app = FastAPI()
        app.include_router(auth_router)
        app.include_router(settings_router)
        app.include_router(comms_router)
        app.include_router(audit_router)

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

    async def _register_headers(self, client: AsyncClient) -> dict[str, str]:
        email = f"user-{uuid.uuid4().hex[:8]}@example.com"
        password = "StrongPass#2026"
        response = await client.post("/api/auth/register", json={"email": email, "password": password})
        self.assertEqual(response.status_code, 201)
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _seed_alert_style_message(self) -> str:
        async with TestSessionLocal() as session:
            channel = await session.get(CommsChannel, "emergency")
            if channel is None:
                session.add(
                    CommsChannel(
                        channel_id="emergency",
                        label="Emergency",
                        frequency_mhz=121.5,
                        health="ONLINE",
                        active_incidents=1,
                    )
                )
            message_id = f"alert_test_{uuid.uuid4().hex[:8]}"
            session.add(
                CommsMessage(
                    id=message_id,
                    channel_id="emergency",
                    source="Test Incident",
                    message="Test alert ack audit",
                    priority="HIGH",
                    created_at=datetime.now(timezone.utc),
                    requires_ack=True,
                    acknowledged=False,
                )
            )
            await session.commit()
            return message_id

    async def test_timeline_logs_settings_and_alert_ack(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            headers = await self._register_headers(client)

            patch_settings = await client.patch(
                "/api/settings/me",
                headers=headers,
                json={"auto_refresh_seconds": 10, "preferred_units": "imperial"},
            )
            self.assertEqual(patch_settings.status_code, 200)

            msg_id = await self._seed_alert_style_message()
            ack = await client.post(f"/api/comms/messages/{msg_id}/ack", headers=headers, json={"note": "ack for audit"})
            self.assertEqual(ack.status_code, 200)

            timeline = await client.get("/api/audit/timeline?limit=100", headers=headers)
            self.assertEqual(timeline.status_code, 200)
            body = timeline.json()
            self.assertGreaterEqual(body["total"], 2)

            actions = [item["action"] for item in body["items"]]
            self.assertIn("SETTINGS_UPDATED", actions)
            self.assertIn("COMMS_MESSAGE_ACKNOWLEDGED", actions)
            self.assertIn("ALERT_ACKNOWLEDGED", actions)

            incident_only = await client.get("/api/audit/timeline?category=INCIDENT", headers=headers)
            self.assertEqual(incident_only.status_code, 200)
            items = incident_only.json()["items"]
            self.assertTrue(all(i["category"] == "INCIDENT" for i in items))


if __name__ == "__main__":
    unittest.main()
