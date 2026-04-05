"""
Schemas for profile and settings endpoints used by the frontend Settings page.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal
from zoneinfo import available_timezones

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

_ICAO_RE = re.compile(r"^[A-Z]{4}$")

LandingView = Literal[
    "map",
    "flights-table",
    "alerts",
    "turnarounds",
    "fuel-analytics",
    "flighttype-explorer",
    "settings",
]

Units = Literal["metric", "imperial"]


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: str
    timezone: str
    contact_number: str | None = None
    is_active: bool
    is_test_user: bool
    created_at: datetime
    updated_at: datetime


class UserProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    role: str | None = Field(default=None, max_length=100)
    timezone: str | None = Field(default=None)
    contact_number: str | None = Field(default=None, max_length=25)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.strip().split())
        if len(normalized) < 2:
            raise ValueError("Must be at least 2 characters")
        return normalized

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.strip().split())
        if not normalized:
            raise ValueError("Role cannot be empty")
        return normalized

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if normalized not in available_timezones():
            raise ValueError("Must be a valid IANA timezone")
        return normalized

    @field_validator("contact_number")
    @classmethod
    def validate_contact_number(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.strip().split())
        if len(normalized) > 25:
            raise ValueError("Must be 25 characters or fewer")
        return normalized


class UserSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    enable_critical_alert_sound: bool
    enable_email_alerts: bool
    show_offline_warning: bool
    highlight_high_risk_turnarounds: bool
    auto_refresh_seconds: Literal[5, 10, 30, 60]
    default_landing_view: LandingView
    default_airport_icao: str
    preferred_units: Units
    map_auto_focus_selected_flight: bool
    default_replay_offset_seconds: Literal[0, -300, -600, -900]
    replay_autoplay_enabled: bool
    updated_at: datetime


class UserSettingsUpdateRequest(BaseModel):
    enable_critical_alert_sound: bool | None = None
    enable_email_alerts: bool | None = None
    show_offline_warning: bool | None = None
    highlight_high_risk_turnarounds: bool | None = None
    auto_refresh_seconds: Literal[5, 10, 30, 60] | None = None
    default_landing_view: LandingView | None = None
    default_airport_icao: str | None = None
    preferred_units: Units | None = None
    map_auto_focus_selected_flight: bool | None = None
    default_replay_offset_seconds: Literal[0, -300, -600, -900] | None = None
    replay_autoplay_enabled: bool | None = None

    @field_validator("default_airport_icao")
    @classmethod
    def validate_airport_icao(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().upper()
        if not _ICAO_RE.fullmatch(normalized):
            raise ValueError("Must be 4 uppercase letters")
        return normalized
