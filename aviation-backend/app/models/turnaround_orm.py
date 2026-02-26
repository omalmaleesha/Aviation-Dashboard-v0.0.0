"""
SQLAlchemy ORM models for the Turnaround Logic Engine.
Persists turnaround records + their 4 ground tasks to SQLite.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.database import Base


class TurnaroundRecord(Base):
    """One row per flight that enters the APPROACHING geofence."""

    __tablename__ = "turnaround_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    flight_id = Column(String(32), unique=True, nullable=False, index=True)
    landing_time = Column(DateTime(timezone=True), nullable=False)
    target_departure_time = Column(DateTime(timezone=True), nullable=False)
    is_completed = Column(Boolean, default=False)
    delay_minutes = Column(Float, default=0.0)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    tasks = relationship(
        "TurnaroundTask",
        back_populates="turnaround",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class TurnaroundTask(Base):
    """Individual ground-handling task within a turnaround."""

    __tablename__ = "turnaround_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    turnaround_id = Column(Integer, ForeignKey("turnaround_records.id"), nullable=False)
    task_name = Column(String(32), nullable=False)            # refueling | cleaning | catering | baggage
    status = Column(String(16), default="PENDING")            # PENDING | IN_PROGRESS | COMPLETED
    estimated_duration_min = Column(Float, nullable=False)    # expected minutes to complete
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    turnaround = relationship("TurnaroundRecord", back_populates="tasks")
