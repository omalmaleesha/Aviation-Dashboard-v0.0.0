"""
Schemas for incident timeline + audit log.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditEventResponse(BaseModel):
    id: int
    category: str
    action: str
    actor_user_id: int | None
    resource_type: str
    resource_id: str | None
    details: dict[str, Any]
    created_at: datetime


class AuditTimelineResponse(BaseModel):
    items: list[AuditEventResponse]
    total: int
    limit: int
    offset: int
