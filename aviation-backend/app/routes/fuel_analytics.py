"""
REST routes for the Fuel Analytics Service.

Endpoints:
  GET /api/analytics/summary         — aggregate totals (lightweight)
  GET /api/analytics/{flight_id}     — single flight details
  GET /api/analytics?limit=&offset=  — paginated list of all flights
"""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, HTTPException, Query

from app.config import FUEL_ANALYTICS_INTERVAL
from app.models.schemas import FuelAnalyticsResponse, FuelAnalyticsSummary
from app.services.fuel_analytics import get_analytics, get_all_analytics

logger = logging.getLogger("skyops.routes.fuel_analytics")

router = APIRouter(tags=["fuel-analytics"])


# ─── Helper: convert a _FuelRecord → response model ─────────────────
def _to_response(rec) -> FuelAnalyticsResponse:
    return FuelAnalyticsResponse(
        flight_id=rec.flight_id,
        aircraft_type=rec.aircraft_type,
        total_fuel_kg=round(rec.total_fuel_kg, 2),
        total_cost_usd=rec.total_cost_usd,
        total_co2_kg=rec.total_co2_kg,
        current_altitude_ft=rec.last_altitude_ft,
        current_velocity_kts=rec.last_velocity_kts,
        updated_every_seconds=FUEL_ANALYTICS_INTERVAL,
    )


# ─── Summary (aggregate — always fast) ──────────────────────────────
@router.get(
    "/api/analytics/summary",
    response_model=FuelAnalyticsSummary,
    summary="Aggregated fuel analytics across all flights",
)
async def fuel_analytics_summary():
    """
    Return combined totals for fuel burn, cost, and CO₂ across every
    tracked flight.  This is the **lightweight** endpoint the frontend
    should poll for dashboard cards — no per-flight list.
    """
    store = get_all_analytics()
    n = len(store)
    total_fuel = sum(r.total_fuel_kg for r in store.values())
    total_cost = round(sum(r.total_cost_usd for r in store.values()), 2)
    total_co2 = round(sum(r.total_co2_kg for r in store.values()), 2)

    return FuelAnalyticsSummary(
        total_flights=n,
        total_fuel_kg=round(total_fuel, 2),
        total_cost_usd=total_cost,
        total_co2_kg=total_co2,
        avg_fuel_per_flight_kg=round(total_fuel / n, 2) if n else 0.0,
        avg_cost_per_flight_usd=round(total_cost / n, 2) if n else 0.0,
        updated_every_seconds=FUEL_ANALYTICS_INTERVAL,
    )


# ─── Single flight analytics ────────────────────────────────────────
@router.get(
    "/api/analytics/{flight_id}",
    response_model=FuelAnalyticsResponse,
    summary="Fuel analytics for one flight",
)
async def flight_fuel_analytics(flight_id: str):
    """
    Return cumulative fuel burn, cost ($1.10/kg), and CO₂ emissions
    (3.16 kg CO₂ per 1 kg fuel) for **flight_id**.
    """
    rec = get_analytics(flight_id)
    if rec is None:
        raise HTTPException(
            status_code=404,
            detail=f"No analytics available for flight '{flight_id}'. "
                   "It may not be currently tracked.",
        )
    return _to_response(rec)


# ─── Paginated list of all flights ──────────────────────────────────
@router.get(
    "/api/analytics",
    response_model=List[FuelAnalyticsResponse],
    summary="Fuel analytics — paginated list",
)
async def all_fuel_analytics(
    limit: int = Query(50, ge=1, le=200, description="Max flights per page"),
    offset: int = Query(0, ge=0, description="Number of flights to skip"),
):
    """
    Return fuel analytics for tracked flights with **pagination**.
    Default: 50 per page.  Max: 200.
    """
    store = get_all_analytics()
    records = list(store.values())
    page = records[offset : offset + limit]
    return [_to_response(rec) for rec in page]
