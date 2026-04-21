"""
ORM model for audit/incident timeline events.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.database import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(32), nullable=False, index=True)  # SETTINGS | COMMS | ALERT | INCIDENT | PROFILE
    action = Column(String(80), nullable=False, index=True)
    actor_user_id = Column(Integer, nullable=True, index=True)
    resource_type = Column(String(64), nullable=False, index=True)
    resource_id = Column(String(120), nullable=True, index=True)
    details_json = Column(Text, nullable=False, default="{}")
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
