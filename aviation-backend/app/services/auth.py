"""
Authentication service layer.
Provides password hashing, JWT generation/validation, and user account flows.
"""

from __future__ import annotations

import re
import uuid
import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import (
    ADMIN_TEST_EMAIL,
    ADMIN_TEST_PASSWORD,
    AUTH_MIN_PASSWORD_LENGTH,
    ENABLE_ADMIN_TEST_USER,
    ENABLE_TEST_USER,
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_ALGORITHM,
    JWT_AUDIENCE,
    JWT_ISSUER,
    JWT_SECRET_KEY,
    TEST_USER_EMAIL,
    TEST_USER_PASSWORD,
)
from app.models.auth_orm import User

_PASSWORD_UPPER_RE = re.compile(r"[A-Z]")
_PASSWORD_LOWER_RE = re.compile(r"[a-z]")
_PASSWORD_DIGIT_RE = re.compile(r"\d")
_PASSWORD_SYMBOL_RE = re.compile(r"[^A-Za-z0-9]")
_PBKDF2_ITERATIONS = 600_000
_ADMIN_ROLES = {"ADMIN", "ADMINISTRATOR"}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )


def validate_password_strength(password: str) -> None:
    if len(password) < AUTH_MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {AUTH_MIN_PASSWORD_LENGTH} characters long",
        )
    if _PASSWORD_UPPER_RE.search(password) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must include at least one uppercase letter",
        )
    if _PASSWORD_LOWER_RE.search(password) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must include at least one lowercase letter",
        )
    if _PASSWORD_DIGIT_RE.search(password) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must include at least one number",
        )
    if _PASSWORD_SYMBOL_RE.search(password) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must include at least one symbol",
        )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        _PBKDF2_ITERATIONS,
    )
    return "pbkdf2_sha256${iterations}${salt}${digest}".format(
        iterations=_PBKDF2_ITERATIONS,
        salt=base64.b64encode(salt).decode("utf-8"),
        digest=base64.b64encode(digest).decode("utf-8"),
    )


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        scheme, iterations_s, salt_b64, digest_b64 = hashed_password.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        iterations = int(iterations_s)
        salt = base64.b64decode(salt_b64.encode("utf-8"))
        expected_digest = base64.b64decode(digest_b64.encode("utf-8"))
    except (ValueError, TypeError):
        return False

    computed_digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(computed_digest, expected_digest)


def create_access_token(*, user_id: int, email: str) -> tuple[str, int]:
    now = _now_utc()
    expires_delta = timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    exp = now + expires_delta
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "jti": str(uuid.uuid4()),
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
            options={"require": ["exp", "iat", "nbf", "iss", "aud", "sub", "jti"]},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == _normalize_email(email)))
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: int) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def register_user(session: AsyncSession, email: str, password: str, is_test_user: bool = False) -> User:
    normalized_email = _normalize_email(email)
    validate_password_strength(password)

    existing = await get_user_by_email(session, normalized_email)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=normalized_email,
        password_hash=hash_password(password),
        role="Operations Controller",
        is_admin=False,
        is_active=True,
        is_test_user=is_test_user,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def authenticate_user(session: AsyncSession, email: str, password: str) -> User:
    user = await get_user_by_email(session, email)
    if user is None:
        raise _unauthorized()

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is disabled")

    if not verify_password(password, user.password_hash):
        raise _unauthorized()

    return user


async def mark_login_success(session: AsyncSession, user: User) -> None:
    user.last_login_at = _now_utc()
    await session.commit()
    await session.refresh(user)


def is_admin_user(user: User) -> bool:
    return bool(user.is_admin) or user.role.strip().upper() in _ADMIN_ROLES


async def authenticate_admin_user(session: AsyncSession, email: str, password: str) -> User:
    user = await authenticate_user(session, email, password)
    if not is_admin_user(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


async def seed_test_user(session: AsyncSession) -> User | None:
    if not ENABLE_TEST_USER:
        return None

    existing = await get_user_by_email(session, TEST_USER_EMAIL)
    if existing is not None:
        return existing

    return await register_user(
        session=session,
        email=TEST_USER_EMAIL,
        password=TEST_USER_PASSWORD,
        is_test_user=True,
    )


async def seed_admin_test_user(session: AsyncSession) -> User | None:
    if not ENABLE_ADMIN_TEST_USER:
        return None

    existing = await get_user_by_email(session, ADMIN_TEST_EMAIL)
    if existing is not None:
        if not existing.is_admin or existing.role.strip().upper() not in _ADMIN_ROLES:
            existing.is_admin = True
            existing.role = "ADMIN"
            await session.commit()
            await session.refresh(existing)
        return existing

    user = await register_user(
        session=session,
        email=ADMIN_TEST_EMAIL,
        password=ADMIN_TEST_PASSWORD,
        is_test_user=True,
    )
    user.is_admin = True
    user.role = "ADMIN"
    await session.commit()
    await session.refresh(user)
    return user
