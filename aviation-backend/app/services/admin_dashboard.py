"""
Service layer for admin dashboard data endpoints.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_orm import AdminAuditLog, AdminIncident
from app.models.auth_orm import User
from app.models.comms_orm import CommsMessage


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _incident_status_from_message(message: CommsMessage) -> str:
    if message.acknowledged:
        return "RESOLVED"
    if (message.priority or "").upper() == "CRITICAL":
        return "INVESTIGATING"
    return "OPEN"


def _metric_status(value: float, *, warn_threshold: float, critical_threshold: float) -> str:
    if value >= critical_threshold:
        return "CRITICAL"
    if value >= warn_threshold:
        return "WARN"
    return "GOOD"


async def _append_audit_log(
    session: AsyncSession,
    *,
    actor_email: str,
    action: str,
    target: str,
    metadata: dict[str, Any],
) -> None:
    audit = AdminAuditLog(
        id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
        actor_email=actor_email,
        action=action,
        target=target,
        metadata_payload=metadata,
    )
    session.add(audit)


async def _sync_incidents_from_comms(session: AsyncSession) -> None:
    """Best-effort sync so incidents exist even without manual seeding."""
    rows = (
        (
            await session.execute(
                select(CommsMessage).where(CommsMessage.priority.in_(["HIGH", "CRITICAL"])).limit(200)
            )
        )
        .scalars()
        .all()
    )

    for row in rows:
        existing = await session.scalar(select(AdminIncident).where(AdminIncident.source_message_id == row.id))
        if existing is None:
            existing = AdminIncident(
                id=f"INC-{uuid.uuid4().hex[:4].upper()}",
                source_message_id=row.id,
                title=(row.message or "Operational incident")[:200],
                severity=(row.priority or "MEDIUM").upper(),
                status=_incident_status_from_message(row),
                affected_system="Comms Service",
                owner_email="ops.supervisor@skyops.com",
                created_at=row.created_at,
            )
            if existing.status == "RESOLVED":
                existing.resolved_at = row.acknowledged_at
            session.add(existing)
        else:
            existing.severity = (row.priority or "MEDIUM").upper()
            existing.status = _incident_status_from_message(row)
            existing.resolved_at = row.acknowledged_at if row.acknowledged else None

    await session.commit()


async def get_admin_overview(session: AsyncSession) -> dict:
    total_users = int((await session.scalar(select(func.count(User.id)))) or 0)

    active_since = datetime.now(timezone.utc) - timedelta(hours=1)
    active_sessions = int(
        (
            await session.scalar(
                select(func.count(User.id)).where(User.last_login_at.is_not(None), User.last_login_at >= active_since)
            )
        )
        or 0
    )

    unresolved_alerts = int(
        (
            await session.scalar(
                select(func.count(CommsMessage.id)).where(
                    CommsMessage.requires_ack == True,  # noqa: E712
                    CommsMessage.acknowledged == False,  # noqa: E712
                )
            )
        )
        or 0
    )

    open_incidents = int(
        (
            await session.scalar(
                select(func.count(CommsMessage.id)).where(
                    CommsMessage.acknowledged == False,  # noqa: E712
                    CommsMessage.priority.in_(["HIGH", "CRITICAL"]),
                )
            )
        )
        or 0
    )

    # Simple health score heuristic from unresolved workload.
    penalty = min(40, open_incidents * 5 + unresolved_alerts)
    system_health_score = max(60, 100 - penalty)

    return {
        "overview": {
            "total_users": total_users,
            "active_sessions": active_sessions,
            "open_incidents": open_incidents,
            "unresolved_alerts": unresolved_alerts,
            "system_health_score": system_health_score,
        }
    }


async def list_admin_users(session: AsyncSession, *, limit: int, offset: int) -> dict:
    total = int((await session.scalar(select(func.count(User.id)))) or 0)

    rows = (
        (
            await session.execute(
                select(User)
                .order_by(User.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )

    items = [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "is_admin": bool(u.is_admin),
            "is_active": bool(u.is_active),
            "is_test_user": bool(u.is_test_user),
            "created_at": u.created_at,
            "last_login_at": u.last_login_at,
        }
        for u in rows
    ]

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


async def update_admin_user_role(
    session: AsyncSession,
    *,
    actor_user: User,
    user_id: int,
    role: str,
) -> dict:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found")

    normalized_role = role.strip().upper()
    if len(normalized_role) < 2:
        raise HTTPException(status_code=422, detail="role must contain at least 2 characters")

    previous_role = user.role
    previous_admin = bool(user.is_admin)
    user.role = normalized_role
    user.is_admin = normalized_role == "ADMIN"

    if actor_user.id == user.id and not user.is_admin:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin role")

    await _append_audit_log(
        session,
        actor_email=actor_user.email,
        action="ROLE_UPDATE",
        target=user.email,
        metadata={
            "from": previous_role,
            "to": user.role,
            "was_admin": previous_admin,
            "is_admin": bool(user.is_admin),
        },
    )
    await session.commit()
    await session.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "is_admin": bool(user.is_admin),
        "is_active": bool(user.is_active),
    }


async def update_admin_user_active(
    session: AsyncSession,
    *,
    actor_user: User,
    user_id: int,
    is_active: bool,
) -> dict:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found")

    if actor_user.id == user.id and not is_active:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")

    previous_active = bool(user.is_active)
    user.is_active = bool(is_active)

    await _append_audit_log(
        session,
        actor_email=actor_user.email,
        action="ACTIVE_UPDATE",
        target=user.email,
        metadata={"from": previous_active, "to": bool(user.is_active)},
    )
    await session.commit()
    await session.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "is_active": bool(user.is_active),
    }


async def list_admin_incidents(
    session: AsyncSession,
    *,
    statuses: list[str] | None,
    limit: int,
) -> dict:
    await _sync_incidents_from_comms(session)

    normalized = [s.strip().upper() for s in (statuses or []) if s.strip()]
    stmt = select(AdminIncident)
    if normalized:
        stmt = stmt.where(AdminIncident.status.in_(normalized))

    stmt = stmt.order_by(AdminIncident.created_at.desc()).limit(limit)
    rows = (await session.execute(stmt)).scalars().all()

    items = [
        {
            "id": row.id,
            "title": row.title,
            "severity": row.severity,
            "status": row.status,
            "affected_system": row.affected_system,
            "created_at": row.created_at,
            "owner": row.owner_email,
        }
        for row in rows
    ]
    return {"items": items}


async def resolve_admin_incident(
    session: AsyncSession,
    *,
    actor_user: User,
    incident_id: str,
) -> dict:
    incident = await session.get(AdminIncident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' not found")

    resolved_at = _utc_now()
    incident.status = "RESOLVED"
    incident.resolved_at = resolved_at
    incident.resolved_by_email = actor_user.email

    if incident.source_message_id:
        message = await session.get(CommsMessage, incident.source_message_id)
        if message is not None:
            message.acknowledged = True
            message.acknowledged_at = resolved_at
            message.note = (message.note or "")[:220] + " [Resolved by admin]"

    await _append_audit_log(
        session,
        actor_email=actor_user.email,
        action="INCIDENT_RESOLVE",
        target=incident.id,
        metadata={"status": "RESOLVED"},
    )
    await session.commit()

    return {
        "id": incident.id,
        "status": incident.status,
        "resolved_at": resolved_at,
        "resolved_by": actor_user.email,
    }


async def list_admin_audit_logs(session: AsyncSession, *, limit: int, offset: int) -> dict:
    total = int((await session.scalar(select(func.count(AdminAuditLog.id)))) or 0)
    rows = (
        (
            await session.execute(
                select(AdminAuditLog)
                .order_by(AdminAuditLog.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )

    items = [
        {
            "id": row.id,
            "actor_email": row.actor_email,
            "action": row.action,
            "target": row.target,
            "created_at": row.created_at,
            "metadata": row.metadata_payload or {},
        }
        for row in rows
    ]
    return {"items": items, "total": total}


async def get_admin_system_metrics(session: AsyncSession) -> dict:
    unresolved = int(
        (
            await session.scalar(
                select(func.count(CommsMessage.id)).where(
                    CommsMessage.requires_ack == True,  # noqa: E712
                    CommsMessage.acknowledged == False,  # noqa: E712
                )
            )
        )
        or 0
    )
    total_messages = int((await session.scalar(select(func.count(CommsMessage.id)))) or 0)
    active_sessions = int(
        (
            await session.scalar(
                select(func.count(User.id)).where(User.last_login_at.is_not(None), User.last_login_at >= _utc_now() - timedelta(hours=1))
            )
        )
        or 0
    )

    latency_ms = float(110 + min(240, unresolved * 6))
    error_rate_pct = float(round((unresolved / max(1, total_messages)) * 100, 2))
    active_sessions_value = float(active_sessions)

    return {
        "items": [
            {
                "id": "latency",
                "label": "API Latency",
                "value": latency_ms,
                "unit": "ms",
                "status": _metric_status(latency_ms, warn_threshold=180, critical_threshold=260),
            },
            {
                "id": "error-rate",
                "label": "Error Rate",
                "value": error_rate_pct,
                "unit": "%",
                "status": _metric_status(error_rate_pct, warn_threshold=1.0, critical_threshold=3.0),
            },
            {
                "id": "active-sessions",
                "label": "Active Sessions",
                "value": active_sessions_value,
                "unit": "count",
                "status": "GOOD",
            },
        ]
    }
