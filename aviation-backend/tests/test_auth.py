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
from app.routes.auth import router as auth_router

TEST_DB_FILE = "./test_auth.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def _create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _drop_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


class TestAuthEndpoints(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        asyncio.run(_create_tables())

        app = FastAPI()
        app.include_router(auth_router)

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

    async def test_register_login_and_me(self) -> None:
        email = f"user-{uuid.uuid4().hex[:8]}@example.com"
        password = "StrongPass#2026"

        async with AsyncClient(
            transport=ASGITransport(app=self.app),
            base_url="http://testserver",
        ) as client:
            register_response = await client.post(
                "/api/auth/register",
                json={"email": email, "password": password},
            )
            self.assertEqual(register_response.status_code, 201)

            register_body = register_response.json()
            self.assertIn("access_token", register_body)
            self.assertEqual(register_body["user"]["email"], email)

            login_response = await client.post(
                "/api/auth/login",
                json={"email": email, "password": password},
            )
            self.assertEqual(login_response.status_code, 200)

            token = login_response.json()["access_token"]
            me_response = await client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            self.assertEqual(me_response.status_code, 200)
            self.assertEqual(me_response.json()["email"], email)

    async def test_login_invalid_password_rejected(self) -> None:
        email = f"user-{uuid.uuid4().hex[:8]}@example.com"
        password = "StrongPass#2026"

        async with AsyncClient(
            transport=ASGITransport(app=self.app),
            base_url="http://testserver",
        ) as client:
            await client.post(
                "/api/auth/register",
                json={"email": email, "password": password},
            )

            bad_login_response = await client.post(
                "/api/auth/login",
                json={"email": email, "password": "wrong-pass"},
            )
            self.assertEqual(bad_login_response.status_code, 401)

    async def test_register_weak_password_rejected(self) -> None:
        email = f"user-{uuid.uuid4().hex[:8]}@example.com"

        async with AsyncClient(
            transport=ASGITransport(app=self.app),
            base_url="http://testserver",
        ) as client:
            weak_password_response = await client.post(
                "/api/auth/register",
                json={"email": email, "password": "weakpass"},
            )
            self.assertEqual(weak_password_response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
