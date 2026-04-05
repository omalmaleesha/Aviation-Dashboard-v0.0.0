"""
Comms API schemas.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CommsPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class CommsHealth(str, Enum):
    ONLINE = "ONLINE"
    DEGRADED = "DEGRADED"
    OFFLINE = "OFFLINE"


class CommsChannelStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    channel_id: str
    label: str
    frequency_mhz: float = Field(..., gt=0)
    health: CommsHealth
    last_heartbeat_at: datetime
    active_incidents: int = 0


class CommsMessage(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    channel_id: str
    source: str
    message: str = Field(..., min_length=1, max_length=2000)
    priority: CommsPriority
    created_at: datetime
    requires_ack: bool
    acknowledged: bool


class CommsOverviewResponse(BaseModel):
    channels: list[CommsChannelStatus]
    messages: list[CommsMessage]
    unread_count: int
    active_incidents: int


class CommsAckRequest(BaseModel):
    note: str | None = Field(default=None, max_length=255)


class CommsAckResponse(BaseModel):
    id: str
    acknowledged: bool
    acknowledged_at: datetime | None
    acknowledged_by: int | None


class CommsMessageListResponse(BaseModel):
    items: list[CommsMessage]
    total: int
    limit: int
    offset: int


class CommsChannelListResponse(BaseModel):
    items: list[CommsChannelStatus]


class CommsWsEvent(BaseModel):
    event: Literal[
        "channel_health_update",
        "message_created",
        "message_acknowledged",
        "incident_update",
    ]
    data: dict
