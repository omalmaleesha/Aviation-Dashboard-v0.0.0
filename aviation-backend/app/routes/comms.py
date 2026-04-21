"""
Comms endpoints + live WebSocket stream.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, get_session
from app.models.comms_schemas import (
    CommsAckRequest,
    CommsAckResponse,
    CommsChannelListResponse,
    CommsMessageListResponse,
    CommsOverviewResponse,
    CommsPriority,
)
from app.routes.auth import get_current_user
from app.services.auth import decode_access_token, get_user_by_id
from app.services.comms import acknowledge_message, get_channels, get_messages, get_overview

router = APIRouter(prefix="/api/comms", tags=["comms"])
bearer_scheme = HTTPBearer(auto_error=False)


def _parse_channel_ids(value: str | None) -> list[str] | None:
    if not value:
        return None
    parsed = [v.strip().lower() for v in value.split(",") if v.strip()]
    return parsed or None


def _parse_since(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=[{"field": "since", "message": "Must be ISO datetime"}]) from exc


@router.get("/overview", response_model=CommsOverviewResponse)
async def comms_overview(
    limit: int = Query(default=30, ge=1, le=100),
    channel_ids: str | None = Query(default=None),
    _user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    parsed_channel_ids = _parse_channel_ids(channel_ids)
    channels, messages, unread_count, active_incidents = await get_overview(
        session,
        limit=limit,
        channel_ids=parsed_channel_ids,
    )
    return CommsOverviewResponse(
        channels=channels,
        messages=messages,
        unread_count=unread_count,
        active_incidents=active_incidents,
    )


@router.post("/messages/{message_id}/ack", response_model=CommsAckResponse)
async def comms_ack_message(
    message_id: str,
    body: CommsAckRequest = CommsAckRequest(),
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    msg = await acknowledge_message(session, message_id=message_id, user_id=user.id, note=body.note)
    return CommsAckResponse(
        id=msg.id,
        acknowledged=msg.acknowledged,
        acknowledged_at=msg.acknowledged_at,
        acknowledged_by=msg.acknowledged_by,
    )


@router.get("/messages", response_model=CommsMessageListResponse)
async def comms_messages(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    priority: CommsPriority | None = Query(default=None),
    channel_id: str | None = Query(default=None),
    acknowledged: bool | None = Query(default=None),
    since: str | None = Query(default=None),
    _user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    since_dt = _parse_since(since)
    items, total = await get_messages(
        session,
        limit=limit,
        offset=offset,
        priority=priority.value if priority else None,
        channel_id=channel_id.lower() if channel_id else None,
        acknowledged=acknowledged,
        since=since_dt,
    )
    return CommsMessageListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/channels", response_model=CommsChannelListResponse)
async def comms_channels(
    _user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    items = await get_channels(session)
    return CommsChannelListResponse(items=items)


async def _get_ws_user(ws: WebSocket):
    auth_header = ws.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        await ws.close(code=1008)
        return None

    token = auth_header.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        await ws.close(code=1008)
        return None

    async with async_session() as session:
        user = await get_user_by_id(session, user_id)
        if user is None or not user.is_active:
            await ws.close(code=1008)
            return None
        return user


@router.websocket("/ws/comms")
async def ws_comms(ws: WebSocket):
    user = await _get_ws_user(ws)
    if user is None:
        return

    await ws.accept()
    last_message_ids: set[str] = set()
    last_ack_ids: set[str] = set()
    last_health: dict[str, str] = {}
    last_incidents = -1

    try:
        while True:
            async with async_session() as session:
                channels, messages, unread_count, active_incidents = await get_overview(
                    session,
                    limit=30,
                    channel_ids=None,
                )

            health_map = {c.channel_id: c.health for c in channels}
            if health_map != last_health:
                await ws.send_text(
                    json.dumps(
                        {"event": "channel_health_update", "data": {"items": [c.model_dump(mode="json") for c in channels]}},
                        default=str,
                    )
                )
                last_health = health_map

            current_message_ids = {m.id for m in messages}
            created_ids = current_message_ids - last_message_ids
            for m in messages:
                if m.id in created_ids:
                    await ws.send_text(
                        json.dumps({"event": "message_created", "data": m.model_dump(mode="json")}, default=str)
                    )
            last_message_ids = current_message_ids

            current_ack_ids = {m.id for m in messages if m.acknowledged}
            acked_now = current_ack_ids - last_ack_ids
            for m in messages:
                if m.id in acked_now:
                    await ws.send_text(
                        json.dumps({"event": "message_acknowledged", "data": {"id": m.id, "acknowledged": True}}, default=str)
                    )
            last_ack_ids = current_ack_ids

            if active_incidents != last_incidents:
                await ws.send_text(
                    json.dumps(
                        {
                            "event": "incident_update",
                            "data": {
                                "active_incidents": active_incidents,
                                "unread_count": unread_count,
                            },
                        },
                        default=str,
                    )
                )
                last_incidents = active_incidents

            await asyncio.sleep(10)
    except WebSocketDisconnect:
        return
