"""
User settings endpoints for frontend settings page.
"""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.user_settings_schemas import UserSettingsResponse
from app.routes.auth import get_current_user
from app.services.user_settings import (
    get_or_create_settings,
    reset_user_settings,
    update_user_settings,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/me", response_model=UserSettingsResponse)
async def get_my_settings(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await get_or_create_settings(session, user.id)


@router.patch("/me", response_model=UserSettingsResponse)
async def patch_my_settings(
    payload: dict = Body(default_factory=dict),
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await update_user_settings(session=session, user_id=user.id, payload=payload)


@router.post("/me/reset", response_model=UserSettingsResponse)
async def reset_my_settings(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await reset_user_settings(session=session, user_id=user.id)
