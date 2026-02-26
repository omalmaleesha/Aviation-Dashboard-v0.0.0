"""
Turnaround Logic Engine — Service Layer
Handles scheduling, task management, and the delay-risk predictor.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import TURNAROUND_TASKS, TURNAROUND_WINDOW_MINUTES
from app.models.schemas import (
    DelayPrediction,
    TaskStatus,
    TurnaroundState,
    TurnaroundTaskSchema,
)
from app.models.turnaround_orm import TurnaroundRecord, TurnaroundTask

logger = logging.getLogger("skyops.turnaround")


# ─── Automated Scheduling ────────────────────────────────────────────
async def initiate_turnaround(flight_id: str, session: AsyncSession) -> TurnaroundRecord:
    """
    Called when a flight's geofence status hits APPROACHING.
    Creates the turnaround record + 4 PENDING tasks.
    Idempotent — won't duplicate if the flight already has a record.
    """
    # Check if already exists
    existing = await session.execute(
        select(TurnaroundRecord).where(TurnaroundRecord.flight_id == flight_id)
    )
    record = existing.scalar_one_or_none()
    if record is not None:
        return record  # already scheduled

    now = datetime.now(timezone.utc)
    target_departure = now + timedelta(minutes=TURNAROUND_WINDOW_MINUTES)

    record = TurnaroundRecord(
        flight_id=flight_id,
        landing_time=now,
        target_departure_time=target_departure,
        is_completed=False,
        delay_minutes=0.0,
    )
    session.add(record)
    await session.flush()  # get record.id

    # Initialize the 4 ground-handling tasks
    for task_name, cfg in TURNAROUND_TASKS.items():
        task = TurnaroundTask(
            turnaround_id=record.id,
            task_name=task_name,
            status=TaskStatus.PENDING.value,
            estimated_duration_min=cfg["duration_min"],
        )
        session.add(task)

    await session.commit()
    logger.info(
        "Turnaround initiated for %s | target departure %s",
        flight_id,
        target_departure.isoformat(),
    )
    return record


# ─── Delay Predictor (The "WOW" Logic) ──────────────────────────────
def predict_delay(record: TurnaroundRecord) -> DelayPrediction:
    """
    Algorithm:
    For each task that is still PENDING or IN_PROGRESS, calculate:
      deadline = target_departure - task_estimated_duration
    If now > deadline, the task cannot finish in time → delay.
    Returns the worst-case delay and the bottleneck task.
    """
    now = datetime.now(timezone.utc)
    target = record.target_departure_time
    if target.tzinfo is None:
        target = target.replace(tzinfo=timezone.utc)

    worst_delay = 0.0
    bottleneck: Optional[str] = None

    for task in record.tasks:
        if task.status == TaskStatus.COMPLETED.value:
            continue

        duration = timedelta(minutes=task.estimated_duration_min)
        deadline = target - duration  # latest moment this task must START

        if now > deadline:
            # This task can't finish before target departure
            overrun = (now - deadline).total_seconds() / 60.0
            if overrun > worst_delay:
                worst_delay = overrun
                bottleneck = task.task_name

    if worst_delay > 0:
        return DelayPrediction(
            at_risk=True,
            estimated_delay_minutes=round(worst_delay, 1),
            bottleneck_task=bottleneck,
            message=(
                f"⚠️ DELAY RISK: {bottleneck} is behind schedule. "
                f"Estimated delay: {worst_delay:.0f} min"
            ),
        )

    return DelayPrediction(
        at_risk=False,
        estimated_delay_minutes=0.0,
        bottleneck_task=None,
        message="✅ All tasks on track for on-time departure",
    )


# ─── Task Status Update ─────────────────────────────────────────────
async def update_task_status(
    flight_id: str,
    task_name: str,
    new_status: TaskStatus,
    session: AsyncSession,
) -> TurnaroundRecord:
    """
    Toggle a specific task's status from the frontend.
    Automatically sets started_at / completed_at timestamps.
    Marks the turnaround as completed when all 4 tasks are done.
    """
    result = await session.execute(
        select(TurnaroundRecord).where(TurnaroundRecord.flight_id == flight_id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise ValueError(f"No turnaround record found for flight {flight_id}")

    now = datetime.now(timezone.utc)
    task_found = False

    for task in record.tasks:
        if task.task_name == task_name:
            task.status = new_status.value
            if new_status == TaskStatus.IN_PROGRESS and task.started_at is None:
                task.started_at = now
            elif new_status == TaskStatus.COMPLETED:
                task.completed_at = now
            task_found = True
            break

    if not task_found:
        raise ValueError(f"Unknown task '{task_name}' for flight {flight_id}")

    # Check if ALL tasks are completed
    all_done = all(t.status == TaskStatus.COMPLETED.value for t in record.tasks)
    if all_done:
        record.is_completed = True
        logger.info("Turnaround COMPLETED for %s", flight_id)

    # Update delay estimate
    prediction = predict_delay(record)
    record.delay_minutes = prediction.estimated_delay_minutes

    await session.commit()
    return record


# ─── State Builder ───────────────────────────────────────────────────
def build_turnaround_state(record: TurnaroundRecord) -> TurnaroundState:
    """Convert an ORM record into the Pydantic response model."""
    now = datetime.now(timezone.utc)

    landing = record.landing_time
    target = record.target_departure_time
    if landing.tzinfo is None:
        landing = landing.replace(tzinfo=timezone.utc)
    if target.tzinfo is None:
        target = target.replace(tzinfo=timezone.utc)

    elapsed = (now - landing).total_seconds() / 60.0
    remaining = (target - now).total_seconds() / 60.0
    total_window = TURNAROUND_WINDOW_MINUTES

    completed_count = sum(1 for t in record.tasks if t.status == TaskStatus.COMPLETED.value)
    progress = (completed_count / max(len(record.tasks), 1)) * 100.0

    tasks = [
        TurnaroundTaskSchema(
            task_name=t.task_name,
            status=TaskStatus(t.status),
            estimated_duration_min=t.estimated_duration_min,
            started_at=t.started_at.isoformat() if t.started_at else None,
            completed_at=t.completed_at.isoformat() if t.completed_at else None,
        )
        for t in record.tasks
    ]

    return TurnaroundState(
        flight_id=record.flight_id,
        landing_time=landing.isoformat(),
        target_departure_time=target.isoformat(),
        is_completed=record.is_completed,
        tasks=tasks,
        delay_prediction=predict_delay(record),
        elapsed_minutes=round(max(0, elapsed), 1),
        remaining_minutes=round(max(0, remaining), 1),
        progress_percent=round(progress, 1),
    )


# ─── Fetch Turnaround ───────────────────────────────────────────────
async def get_turnaround(flight_id: str, session: AsyncSession) -> Optional[TurnaroundRecord]:
    """Retrieve a turnaround record by flight ID."""
    result = await session.execute(
        select(TurnaroundRecord).where(TurnaroundRecord.flight_id == flight_id)
    )
    return result.scalar_one_or_none()


async def get_all_active_turnarounds(session: AsyncSession) -> list[TurnaroundRecord]:
    """Retrieve all non-completed turnarounds."""
    result = await session.execute(
        select(TurnaroundRecord).where(TurnaroundRecord.is_completed == False)
    )
    return list(result.scalars().all())
