"""
SQLAlchemy ORM model for per-user settings/preferences.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String

from app.database import Base


class UserSettings(Base):
    """One settings row per user account."""

    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    enable_critical_alert_sound = Column(Boolean, nullable=False, default=True)
    enable_email_alerts = Column(Boolean, nullable=False, default=False)
    show_offline_warning = Column(Boolean, nullable=False, default=True)
    highlight_high_risk_turnarounds = Column(Boolean, nullable=False, default=True)

    auto_refresh_seconds = Column(Integer, nullable=False, default=5)
    default_landing_view = Column(String(32), nullable=False, default="map")
    default_airport_icao = Column(String(4), nullable=False, default="KJFK")
    preferred_units = Column(String(16), nullable=False, default="metric")

    map_auto_focus_selected_flight = Column(Boolean, nullable=False, default=True)
    default_replay_offset_seconds = Column(Integer, nullable=False, default=0)
    replay_autoplay_enabled = Column(Boolean, nullable=False, default=False)

    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
