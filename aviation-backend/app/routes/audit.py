"""
Incident timeline + audit log endpoints.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.audit_schemas import AuditEventResponse, AuditTimelineResponse
from app.routes.auth import get_current_user
from app.services.audit import audit_event_details, list_audit_events

router = APIRouter(prefix="/api/audit", tags=["audit"])


def _parse_since(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=[{"field": "since", "message": "Must be ISO datetime"}]) from exc


@router.get("/timeline", response_model=AuditTimelineResponse)
async def get_audit_timeline(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    category: str | None = Query(default=None),
    actor_user_id: int | None = Query(default=None),
    action: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    since: str | None = Query(default=None),
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    since_dt = _parse_since(since)
    items, total = await list_audit_events(
        session,
        limit=limit,
        offset=offset,
        category=category,
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        since=since_dt,
    )

    response_items = [
        AuditEventResponse(
            id=i.id,
            category=i.category,
            action=i.action,
            actor_user_id=i.actor_user_id,
            resource_type=i.resource_type,
            resource_id=i.resource_id,
            details=audit_event_details(i),
            created_at=i.created_at,
        )
        for i in items
    ]
    return AuditTimelineResponse(items=response_items, total=total, limit=limit, offset=offset)
