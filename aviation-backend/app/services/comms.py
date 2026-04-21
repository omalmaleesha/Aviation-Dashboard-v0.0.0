"""
Comms service.
Uses free internal data sources (alerts + system health) to populate channels/messages.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comms_orm import CommsChannel, CommsMessage
from app.models.comms_schemas import CommsHealth, CommsPriority
from app.services.alerts import get_alert_history
from app.services.opensky import is_connected

_DEFAULT_CHANNELS: tuple[dict, ...] = (
    {"channel_id": "tower", "label": "Tower", "frequency_mhz": 118.3},
    {"channel_id": "ground", "label": "Ground Ops", "frequency_mhz": 121.9},
    {"channel_id": "dispatch", "label": "Dispatch", "frequency_mhz": 123.45},
    {"channel_id": "emergency", "label": "Emergency", "frequency_mhz": 121.5},
)

_HIGH_PRIORITIES = [CommsPriority.HIGH.value, CommsPriority.CRITICAL.value]


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _count(session: AsyncSession, stmt) -> int:
    return int((await session.scalar(stmt)) or 0)


def _priority_from_alert_severity(severity: str) -> str:
    severity_up = (severity or "").upper()
    if severity_up == "CRITICAL":
        return CommsPriority.CRITICAL.value
    if severity_up == "WARNING":
        return CommsPriority.HIGH.value
    return CommsPriority.MEDIUM.value


async def ensure_default_channels(session: AsyncSession) -> None:
    for row in _DEFAULT_CHANNELS:
        existing = await session.get(CommsChannel, row["channel_id"])
        if existing is None:
            session.add(CommsChannel(**row, health=CommsHealth.ONLINE.value, active_incidents=0))
    await session.commit()


async def _sync_channel_health(session: AsyncSession) -> None:
    connected = is_connected()
    channels = (await session.execute(select(CommsChannel))).scalars().all()
    for ch in channels:
        ch.health = CommsHealth.ONLINE.value if connected else CommsHealth.DEGRADED.value
        ch.last_heartbeat_at = _now()
    await session.commit()


async def sync_free_data(session: AsyncSession) -> None:
    """Ingest alert history into comms messages and update channel incidents."""
    await ensure_default_channels(session)
    await _sync_channel_health(session)

    alerts = get_alert_history()[:200]
    for alert in alerts:
        msg_id = f"alert_{alert.id}"
        existing = await session.get(CommsMessage, msg_id)
        if existing is not None:
            continue
        session.add(
            CommsMessage(
                id=msg_id,
                channel_id="emergency",
                source="Geofence Alert Engine",
                message=alert.message,
                priority=_priority_from_alert_severity(alert.severity.value),
                created_at=datetime.fromisoformat(alert.timestamp),
                requires_ack=True,
                acknowledged=False,
            )
        )

    await session.commit()

    channels = (await session.execute(select(CommsChannel))).scalars().all()
    for ch in channels:
        incidents_count = await _count(
            session,
            select(func.count())
            .select_from(CommsMessage)
            .where(
                CommsMessage.channel_id == ch.channel_id,
                CommsMessage.acknowledged.is_(False),
                CommsMessage.priority.in_(_HIGH_PRIORITIES),
            )
        )
        ch.active_incidents = incidents_count
    await session.commit()


async def get_channels(session: AsyncSession, channel_ids: Iterable[str] | None = None) -> list[CommsChannel]:
    await sync_free_data(session)
    stmt = select(CommsChannel)
    if channel_ids:
        stmt = stmt.where(CommsChannel.channel_id.in_(list(channel_ids)))
    stmt = stmt.order_by(CommsChannel.channel_id.asc())
    return list((await session.execute(stmt)).scalars().all())


async def get_messages(
    session: AsyncSession,
    *,
    limit: int,
    offset: int,
    priority: str | None = None,
    channel_id: str | None = None,
    acknowledged: bool | None = None,
    since: datetime | None = None,
) -> tuple[list[CommsMessage], int]:
    await sync_free_data(session)

    filters = []
    if priority:
        filters.append(CommsMessage.priority == priority)
    if channel_id:
        filters.append(CommsMessage.channel_id == channel_id)
    if acknowledged is not None:
        filters.append(CommsMessage.acknowledged == acknowledged)
    if since is not None:
        filters.append(CommsMessage.created_at >= since)

    base_stmt = select(CommsMessage)
    count_stmt = select(func.count()).select_from(CommsMessage)
    for f in filters:
        base_stmt = base_stmt.where(f)
        count_stmt = count_stmt.where(f)

    items_stmt = base_stmt.order_by(CommsMessage.created_at.desc()).offset(offset).limit(limit)
    items = list((await session.execute(items_stmt)).scalars().all())
    total = await _count(session, count_stmt)
    return items, total


async def get_overview(
    session: AsyncSession,
    *,
    limit: int,
    channel_ids: list[str] | None,
) -> tuple[list[CommsChannel], list[CommsMessage], int, int]:
    channels = await get_channels(session, channel_ids=channel_ids)
    channel_id_filter = [c.channel_id for c in channels]

    filters = []
    if channel_id_filter:
        filters.append(CommsMessage.channel_id.in_(channel_id_filter))

    stmt = select(CommsMessage)
    unread_stmt = select(func.count()).select_from(CommsMessage).where(
        CommsMessage.requires_ack.is_(True),
        CommsMessage.acknowledged.is_(False),
    )
    for f in filters:
        stmt = stmt.where(f)
        unread_stmt = unread_stmt.where(f)

    stmt = stmt.order_by(CommsMessage.created_at.desc()).limit(limit)
    messages = list((await session.execute(stmt)).scalars().all())
    unread_count = await _count(session, unread_stmt)
    active_incidents = sum(c.active_incidents for c in channels)
    return channels, messages, unread_count, active_incidents


async def acknowledge_message(
    session: AsyncSession,
    *,
    message_id: str,
    user_id: int,
    note: str | None,
) -> CommsMessage:
    await sync_free_data(session)
    message = await session.get(CommsMessage, message_id)
    if message is None:
        raise HTTPException(status_code=404, detail=f"Comms message '{message_id}' not found")

    if not message.acknowledged:
        message.acknowledged = True
        message.acknowledged_at = _now()
        message.acknowledged_by = user_id

    if note is not None:
        message.note = note.strip()[:255]

    await session.commit()
    await session.refresh(message)
    return message
