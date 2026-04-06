"""
SQLAlchemy ORM models for admin incidents and audit logs.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, String, Text

from app.database import Base


class AdminIncident(Base):
    __tablename__ = "admin_incidents"

    id = Column(String(40), primary_key=True)
    source_message_id = Column(String(80), nullable=True, unique=True, index=True)
    title = Column(String(200), nullable=False)
    severity = Column(String(20), nullable=False, default="MEDIUM")
    status = Column(String(20), nullable=False, default="OPEN", index=True)
    affected_system = Column(String(120), nullable=False, default="Comms Service")
    owner_email = Column(String(254), nullable=False, default="ops.supervisor@skyops.com")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by_email = Column(String(254), nullable=True)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(String(40), primary_key=True)
    actor_email = Column(String(254), nullable=False, index=True)
    action = Column(String(80), nullable=False, index=True)
    target = Column(String(254), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    metadata_payload = Column(JSON, nullable=False, default=dict)
    note = Column(Text, nullable=True)
