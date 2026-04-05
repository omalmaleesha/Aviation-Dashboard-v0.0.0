"""
Service layer for user profile and settings endpoints.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth_orm import User
from app.models.settings_orm import UserSettings
from app.models.user_settings_schemas import UserProfileUpdateRequest, UserSettingsUpdateRequest


def validation_error_to_http(exc: ValidationError) -> HTTPException:
    detail: list[dict[str, str]] = []
    for error in exc.errors(include_url=False):
        loc = error.get("loc", ())
        field = str(loc[-1]) if loc else "body"
        detail.append({"field": field, "message": error.get("msg", "Invalid value")})
    return HTTPException(status_code=422, detail=detail)


async def update_user_profile(
    session: AsyncSession,
    user: User,
    payload: dict,
) -> User:
    try:
        body = UserProfileUpdateRequest.model_validate(payload)
    except ValidationError as exc:
        raise validation_error_to_http(exc) from exc

    db_user = await session.get(User, user.id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(db_user, field, value)

    db_user.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(db_user)
    return db_user


async def get_or_create_settings(session: AsyncSession, user_id: int) -> UserSettings:
    result = await session.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    settings = result.scalar_one_or_none()
    if settings is not None:
        return settings

    settings = UserSettings(user_id=user_id)
    session.add(settings)
    await session.commit()
    await session.refresh(settings)
    return settings


async def update_user_settings(
    session: AsyncSession,
    user_id: int,
    payload: dict,
) -> UserSettings:
    try:
        body = UserSettingsUpdateRequest.model_validate(payload)
    except ValidationError as exc:
        raise validation_error_to_http(exc) from exc

    settings = await get_or_create_settings(session, user_id)
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(settings, field, value)

    settings.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(settings)
    return settings


async def reset_user_settings(session: AsyncSession, user_id: int) -> UserSettings:
    settings = await get_or_create_settings(session, user_id)

    settings.enable_critical_alert_sound = True
    settings.enable_email_alerts = False
    settings.show_offline_warning = True
    settings.highlight_high_risk_turnarounds = True
    settings.auto_refresh_seconds = 5
    settings.default_landing_view = "map"
    settings.default_airport_icao = "KJFK"
    settings.preferred_units = "metric"
    settings.map_auto_focus_selected_flight = True
    settings.default_replay_offset_seconds = 0
    settings.replay_autoplay_enabled = False
    settings.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(settings)
    return settings
