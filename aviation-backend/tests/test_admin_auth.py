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
from app.models import auth_orm  # noqa: F401
from app.models.auth_orm import User
from app.routes.auth import router as auth_router

TEST_DB_FILE = "./test_admin_auth.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def _create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def _drop_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


class TestAdminAuthEndpoints(unittest.IsolatedAsyncioTestCase):
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

    async def test_admin_login_and_admin_me(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            # Register a normal user first and promote to admin via DB for deterministic test.
            email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
            password = "StrongPass#2026"
            register = await client.post("/api/auth/register", json={"email": email, "password": password})
            self.assertEqual(register.status_code, 201)

            async with TestSessionLocal() as session:
                result = await session.execute(select(User).where(User.email == email))
                user = result.scalar_one()
                user.is_admin = True
                user.role = "ADMIN"
                await session.commit()

            admin_login = await client.post("/api/auth/admin/login", json={"email": email, "password": password})
            self.assertEqual(admin_login.status_code, 200)
            body = admin_login.json()
            self.assertTrue(body["user"]["is_admin"])

            token = body["access_token"]
            admin_me = await client.get("/api/auth/admin/me", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(admin_me.status_code, 200)
            self.assertTrue(admin_me.json()["is_admin"])

    async def test_non_admin_rejected_for_admin_login(self) -> None:
        async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://testserver") as client:
            email = f"user-{uuid.uuid4().hex[:8]}@example.com"
            password = "StrongPass#2026"
            register = await client.post("/api/auth/register", json={"email": email, "password": password})
            self.assertEqual(register.status_code, 201)

            admin_login = await client.post("/api/auth/admin/login", json={"email": email, "password": password})
            self.assertEqual(admin_login.status_code, 403)


if __name__ == "__main__":
    unittest.main()
