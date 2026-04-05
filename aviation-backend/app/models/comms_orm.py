"""
SQLAlchemy ORM models for Comms feature.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text

from app.database import Base


class CommsChannel(Base):
    __tablename__ = "comms_channels"

    channel_id = Column(String(64), primary_key=True)
    label = Column(String(100), nullable=False)
    frequency_mhz = Column(Float, nullable=False)
    health = Column(String(16), nullable=False, default="ONLINE")
    last_heartbeat_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    active_incidents = Column(Integer, nullable=False, default=0)


class CommsMessage(Base):
    __tablename__ = "comms_messages"

    id = Column(String(80), primary_key=True)
    channel_id = Column(String(64), ForeignKey("comms_channels.channel_id"), nullable=False, index=True)
    source = Column(String(120), nullable=False)
    message = Column(Text, nullable=False)
    priority = Column(String(16), nullable=False, default="MEDIUM")
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    requires_ack = Column(Boolean, nullable=False, default=False)
    acknowledged = Column(Boolean, nullable=False, default=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(Integer, nullable=True)
    note = Column(String(255), nullable=True)
