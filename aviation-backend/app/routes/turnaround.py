"""
Turnaround Logic Engine — API Routes
POST /api/turnaround/{flight_id}/update  — toggle task status
GET  /api/turnaround/{flight_id}         — current timeline + delay risk
GET  /api/turnarounds                    — all active turnarounds
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.schemas import TaskUpdateRequest, TurnaroundState
from app.services.turnaround import (
    build_turnaround_state,
    get_all_active_turnarounds,
    get_turnaround,
    update_task_status,
)

router = APIRouter(tags=["turnaround"])


# ─── GET single turnaround ───────────────────────────────────────────
@router.get("/api/turnaround/{flight_id}", response_model=TurnaroundState)
async def get_turnaround_route(
    flight_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Return the current timeline progress and delay risk for a flight."""
    record = await get_turnaround(flight_id, session)
    if record is None:
        raise HTTPException(status_code=404, detail=f"No turnaround found for {flight_id}")
    return build_turnaround_state(record)


# ─── POST update task status ─────────────────────────────────────────
@router.post("/api/turnaround/{flight_id}/update", response_model=TurnaroundState)
async def update_turnaround_task(
    flight_id: str,
    body: TaskUpdateRequest,
    session: AsyncSession = Depends(get_session),
):
    """Toggle a ground-handling task status from the frontend."""
    try:
        record = await update_task_status(
            flight_id=flight_id,
            task_name=body.task_name,
            new_status=body.status,
            session=session,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return build_turnaround_state(record)


# ─── GET all active turnarounds ──────────────────────────────────────
@router.get("/api/turnarounds", response_model=List[TurnaroundState])
async def list_active_turnarounds(
    session: AsyncSession = Depends(get_session),
):
    """Return all non-completed turnarounds with delay predictions."""
    records = await get_all_active_turnarounds(session)
    return [build_turnaround_state(r) for r in records]
