"""REST routes for aircraft type catalog and details."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException

from app.models.schemas import AircraftTypeDetail
from app.services.aircraft_catalog import (
    get_aircraft_type,
    get_aircraft_type_for_flight,
    list_aircraft_types,
)

router = APIRouter(tags=["aircraft-types"])


@router.get("/api/aircraft-types", response_model=List[AircraftTypeDetail])
async def all_aircraft_types():
    """Return full catalog of supported aircraft types."""
    return list_aircraft_types()


@router.get("/api/aircraft-types/{type_id}", response_model=AircraftTypeDetail)
async def aircraft_type_by_id(type_id: str):
    """Return complete aircraft specification by type ID (e.g., A320)."""
    details = get_aircraft_type(type_id)
    if details is None:
        raise HTTPException(
            status_code=404,
            detail=f"Aircraft type '{type_id}' is not available in the catalog.",
        )
    return details


@router.get("/api/flights/{flight_id}/aircraft-type", response_model=AircraftTypeDetail)
async def aircraft_type_by_flight(flight_id: str):
    """Return aircraft specifications for the currently tracked flight."""
    details = get_aircraft_type_for_flight(flight_id)
    if details is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No aircraft type details found for flight '{flight_id}'. "
                "The flight may be untracked or mapped to an unsupported type."
            ),
        )
    return details
