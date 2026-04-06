"""
Schemas for admin dashboard endpoints.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AdminOverviewStats(BaseModel):
    total_users: int
    active_sessions: int
    open_incidents: int
    unresolved_alerts: int
    system_health_score: int


class AdminOverviewResponse(BaseModel):
    overview: AdminOverviewStats


class AdminUserItem(BaseModel):
    id: int
    email: str
    role: str
    is_admin: bool
    is_active: bool
    is_test_user: bool
    created_at: datetime
    last_login_at: datetime | None = None


class AdminUsersListResponse(BaseModel):
    items: list[AdminUserItem]
    total: int
    limit: int
    offset: int


class AdminUpdateRoleRequest(BaseModel):
    role: str = Field(min_length=2, max_length=64)


class AdminUpdateRoleResponse(BaseModel):
    id: int
    email: str
    role: str
    is_admin: bool
    is_active: bool


class AdminUpdateActiveRequest(BaseModel):
    is_active: bool


class AdminUpdateActiveResponse(BaseModel):
    id: int
    email: str
    is_active: bool


class AdminIncidentItem(BaseModel):
    id: str
    title: str
    severity: str
    status: str
    affected_system: str
    created_at: datetime
    owner: str


class AdminIncidentsListResponse(BaseModel):
    items: list[AdminIncidentItem]


class AdminResolveIncidentResponse(BaseModel):
    id: str
    status: str
    resolved_at: datetime
    resolved_by: str


class AdminAuditLogItem(BaseModel):
    id: str
    actor_email: str
    action: str
    target: str
    created_at: datetime
    metadata: dict[str, Any]


class AdminAuditLogsResponse(BaseModel):
    items: list[AdminAuditLogItem]
    total: int


class AdminSystemMetricItem(BaseModel):
    id: str
    label: str
    value: float
    unit: str
    status: str


class AdminSystemMetricsResponse(BaseModel):
    items: list[AdminSystemMetricItem]
