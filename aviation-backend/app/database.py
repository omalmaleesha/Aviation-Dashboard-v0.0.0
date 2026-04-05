"""
Async SQLAlchemy engine & session factory.
Uses SQLite for lightweight persistence that survives server restarts.
"""

from __future__ import annotations

import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./skyops_sentinel.db")

engine = create_async_engine(DATABASE_URL, echo=False)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


def _ensure_users_profile_columns(sync_conn) -> None:
    """Best-effort backfill for users table columns on existing SQLite DBs."""
    result = sync_conn.exec_driver_sql("PRAGMA table_info(users)")
    existing_columns = {row[1] for row in result.fetchall()}

    statements: list[str] = []
    if "full_name" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN full_name VARCHAR(120) NOT NULL DEFAULT 'Aviation Operator'"
        )
    if "role" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN role VARCHAR(100) NOT NULL DEFAULT 'Operations Controller'"
        )
    if "timezone" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'UTC'"
        )
    if "contact_number" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN contact_number VARCHAR(25)")

    for stmt in statements:
        sync_conn.exec_driver_sql(stmt)


async def init_db() -> None:
    """Create all tables (idempotent — safe to call on every startup)."""
    # Ensure all ORM models are imported before metadata.create_all()
    # so SQLAlchemy knows every table definition.
    from app.models import auth_orm as _auth_orm  # noqa: F401
    from app.models import settings_orm as _settings_orm  # noqa: F401
    from app.models import turnaround_orm as _turnaround_orm  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_users_profile_columns)


async def get_session() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency — yields a scoped async session."""
    async with async_session() as session:
        yield session
