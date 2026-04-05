"""
User profile endpoints for frontend settings page.
"""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.user_settings_schemas import UserProfileResponse
from app.routes.auth import get_current_user
from app.services.user_settings import update_user_profile

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(user=Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserProfileResponse)
async def patch_my_profile(
    payload: dict = Body(default_factory=dict),
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await update_user_profile(session=session, user=user, payload=payload)
