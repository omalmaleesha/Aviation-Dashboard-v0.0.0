"""
Audit log/timeline service.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_orm import AuditEvent


def _to_json(value: dict[str, Any] | None) -> str:
    return json.dumps(value or {}, default=str)


def _from_json(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {"value": parsed}
    except Exception:
        return {}


async def add_audit_event(
    session: AsyncSession,
    *,
    category: str,
    action: str,
    actor_user_id: int | None,
    resource_type: str,
    resource_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        category=category,
        action=action,
        actor_user_id=actor_user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        details_json=_to_json(details),
    )
    session.add(event)
    return event


async def list_audit_events(
    session: AsyncSession,
    *,
    limit: int,
    offset: int,
    category: str | None = None,
    actor_user_id: int | None = None,
    action: str | None = None,
    resource_type: str | None = None,
    since: datetime | None = None,
) -> tuple[list[AuditEvent], int]:
    base = select(AuditEvent)
    count_stmt = select(func.count()).select_from(AuditEvent)

    filters = []
    if category:
        filters.append(AuditEvent.category == category)
    if actor_user_id is not None:
        filters.append(AuditEvent.actor_user_id == actor_user_id)
    if action:
        filters.append(AuditEvent.action == action)
    if resource_type:
        filters.append(AuditEvent.resource_type == resource_type)
    if since:
        filters.append(AuditEvent.created_at >= since)

    for f in filters:
        base = base.where(f)
        count_stmt = count_stmt.where(f)

    items_stmt = base.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).offset(offset).limit(limit)
    items = list((await session.execute(items_stmt)).scalars().all())
    total = int((await session.scalar(count_stmt)) or 0)
    return items, total


def audit_event_details(event: AuditEvent) -> dict[str, Any]:
    return _from_json(event.details_json)
