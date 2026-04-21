"""
Admin dashboard endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.admin_schemas import (
    AdminAuditLogsResponse,
    AdminIncidentsListResponse,
    AdminOverviewResponse,
    AdminResolveIncidentResponse,
    AdminSystemMetricsResponse,
    AdminUpdateActiveRequest,
    AdminUpdateActiveResponse,
    AdminUpdateRoleRequest,
    AdminUpdateRoleResponse,
    AdminUsersListResponse,
)
from app.routes.auth import get_current_admin_user
from app.services.admin_dashboard import (
    get_admin_overview,
    get_admin_system_metrics,
    list_admin_audit_logs,
    list_admin_incidents,
    list_admin_users,
    resolve_admin_incident,
    update_admin_user_active,
    update_admin_user_role,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/overview", response_model=AdminOverviewResponse)
async def admin_overview(
    _admin_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    return await get_admin_overview(session)


@router.get("/users", response_model=AdminUsersListResponse)
async def admin_users(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _admin_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    return await list_admin_users(session, limit=limit, offset=offset)


@router.patch("/users/{user_id}/role", response_model=AdminUpdateRoleResponse)
async def admin_update_user_role(
    user_id: int,
    body: AdminUpdateRoleRequest,
    admin_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    return await update_admin_user_role(
        session,
        actor_user=admin_user,
        user_id=user_id,
        role=body.role,
    )


@router.patch("/users/{user_id}/active", response_model=AdminUpdateActiveResponse)
async def admin_update_user_active(
    user_id: int,
    body: AdminUpdateActiveRequest,
    admin_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    return await update_admin_user_active(
        session,
        actor_user=admin_user,
        user_id=user_id,
        is_active=body.is_active,
    )


@router.get("/incidents", response_model=AdminIncidentsListResponse)
async def admin_incidents(
    status: str | None = Query(
        default=None,
        description="Comma-separated statuses: open,investigating,resolved",
    ),
    limit: int = Query(default=20, ge=1, le=200),
    _admin_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    statuses = [s.strip() for s in status.split(",")] if status else None
    return await list_admin_incidents(session, statuses=statuses, limit=limit)


@router.post("/incidents/{incident_id}/resolve", response_model=AdminResolveIncidentResponse)
async def admin_resolve_incident(
    incident_id: str,
    admin_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    return await resolve_admin_incident(
        session,
        actor_user=admin_user,
        incident_id=incident_id,
    )


@router.get("/audit-logs", response_model=AdminAuditLogsResponse)
async def admin_audit_logs(
    limit: int = Query(default=30, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _admin_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    return await list_admin_audit_logs(session, limit=limit, offset=offset)


@router.get("/system/metrics", response_model=AdminSystemMetricsResponse)
async def admin_system_metrics(
    _admin_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    return await get_admin_system_metrics(session)
