"""
Authentication API routes.
"""

from __future__ import annotations

from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.auth_schemas import LoginRequest, RegisterRequest, TokenResponse, UserPublic
from app.services.auth import (
    authenticate_user,
    create_access_token,
    decode_access_token,
    get_user_by_id,
    register_user,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)


def _to_user_public(user) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        is_active=user.is_active,
        is_test_user=user.is_test_user,
        created_at=(
            user.created_at.replace(tzinfo=timezone.utc)
            if user.created_at and user.created_at.tzinfo is None
            else user.created_at
        ),
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing bearer token")

    payload = decode_access_token(credentials.credentials)
    subject = payload.get("sub")
    if subject is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    try:
        user_id = int(subject)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token subject") from exc

    user = await get_user_by_id(session, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return user


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    body: RegisterRequest,
    session: AsyncSession = Depends(get_session),
):
    user = await register_user(session, body.email, body.password)
    token, expires_in = create_access_token(user_id=user.id, email=user.email)
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=_to_user_public(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    user = await authenticate_user(session, body.email, body.password)
    token, expires_in = create_access_token(user_id=user.id, email=user.email)
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=_to_user_public(user),
    )


@router.get("/me", response_model=UserPublic)
async def me(user=Depends(get_current_user)):
    return _to_user_public(user)
