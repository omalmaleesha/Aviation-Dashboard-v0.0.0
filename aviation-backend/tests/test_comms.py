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
from app.models import comms_orm  # noqa: F401
from app.models import settings_orm  # noqa: F401
from app.routes.auth import router as auth_router
from app.routes.comms import router as comms_router

TEST_DB_FILE = "./test_comms.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def _create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _drop_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


class TestCommsEndpoints(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        asyncio.run(_create_tables())

        app = FastAPI()
        app.include_router(auth_router)
        app.include_router(comms_router)

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

    async def _register_and_headers(self, client: AsyncClient) -> dict[str, str]:
        email = f"user-{uuid.uuid4().hex[:8]}@example.com"
        password = "StrongPass#2026"
        register_response = await client.post(
            "/api/auth/register",
            json={"email": email, "password": password},
        )
        self.assertEqual(register_response.status_code, 201)
        token = register_response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_overview_and_channels(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            headers = await self._register_and_headers(client)

            overview = await client.get("/api/comms/overview", headers=headers)
            self.assertEqual(overview.status_code, 200)
            body = overview.json()
            self.assertIn("channels", body)
            self.assertIn("messages", body)
            self.assertIn("unread_count", body)

            channels = await client.get("/api/comms/channels", headers=headers)
            self.assertEqual(channels.status_code, 200)
            self.assertGreaterEqual(len(channels.json()["items"]), 1)

    async def test_ack_idempotent(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            headers = await self._register_and_headers(client)

            messages_resp = await client.get("/api/comms/messages?limit=1", headers=headers)
            self.assertEqual(messages_resp.status_code, 200)
            items = messages_resp.json()["items"]
            if not items:
                self.skipTest("No comms messages available yet")

            message_id = items[0]["id"]
            ack1 = await client.post(f"/api/comms/messages/{message_id}/ack", headers=headers, json={"note": "first ack"})
            self.assertEqual(ack1.status_code, 200)
            self.assertTrue(ack1.json()["acknowledged"])

            ack2 = await client.post(f"/api/comms/messages/{message_id}/ack", headers=headers, json={"note": "repeat ack"})
            self.assertEqual(ack2.status_code, 200)
            self.assertTrue(ack2.json()["acknowledged"])

    async def test_messages_filter_validation(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            headers = await self._register_and_headers(client)

            bad_since = await client.get("/api/comms/messages?since=not-a-date", headers=headers)
            self.assertEqual(bad_since.status_code, 422)
            detail = bad_since.json().get("detail", [])
            self.assertIsInstance(detail, list)
            self.assertEqual(detail[0].get("field"), "since")


if __name__ == "__main__":
    unittest.main()
