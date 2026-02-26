"""
Pydantic models — strict type-safety for every flight object that
crosses any boundary (API ↔ WebSocket ↔ Frontend).
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ─── Flight Status Enum ──────────────────────────────────────────────
class FlightStatus(str, Enum):
    EN_ROUTE = "EN_ROUTE"
    DESCENDING = "DESCENDING"
    APPROACHING = "APPROACHING"
    ON_GROUND = "ON_GROUND"
    UNKNOWN = "UNKNOWN"


# ─── Core Flight Schema (matches frontend contract) ─────────────────
class FlightData(BaseModel):
    """
    JSON shape the frontend expects on every WebSocket frame:
    { flightId, origin, destination, status, progress, altitude, speed, lat, lng, heading, last_updated }
    """

    flightId: str = Field(..., description="ICAO24 transponder address or synthetic ID")
    origin: Optional[str] = Field(None, description="Origin airport ICAO code")
    destination: Optional[str] = Field(None, description="Destination airport ICAO code")
    status: FlightStatus = Field(FlightStatus.UNKNOWN, description="Computed flight status")
    progress: float = Field(0.0, ge=0.0, le=100.0, description="Estimated journey progress %")
    altitude: float = Field(0.0, description="Barometric altitude in feet")
    speed: float = Field(0.0, description="Ground speed in knots")
    lat: float = Field(..., description="WGS-84 latitude")
    lng: float = Field(..., description="WGS-84 longitude")
    heading: float = Field(0.0, ge=0.0, le=360.0, description="True heading in degrees")
    distance_to_airport: float = Field(0.0, description="Distance to base airport in km")
    last_updated: Optional[str] = Field(None, description="ISO 8601 UTC timestamp of last data refresh")


# ─── Geofence Alert ─────────────────────────────────────────────────
class AlertSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class GeofenceAlert(BaseModel):
    """Fired when a flight enters the inner geofence (< 5 km from airport)."""
    id: str = Field(..., description="Unique alert ID")
    flightId: str = Field(..., description="Flight that triggered the alert")
    distance_km: float = Field(..., description="Distance to airport when alert fired")
    altitude: float = Field(0.0, description="Altitude in feet at trigger time")
    lat: float = Field(..., description="Latitude at trigger time")
    lng: float = Field(..., description="Longitude at trigger time")
    severity: AlertSeverity = Field(AlertSeverity.WARNING)
    message: str = Field(..., description="Human-readable alert text")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp")


# ─── METAR Response ──────────────────────────────────────────────────
class METARResponse(BaseModel):
    icao: str
    raw: str
    decoded: str
    timestamp: str


# ─── System Health ───────────────────────────────────────────────────
class SystemHealth(BaseModel):
    status: str = Field("HEALTHY", description="HEALTHY | DEGRADED | UNHEALTHY")
    opensky_connected: bool = Field(False)
    active_flights: int = Field(0)
    connected_clients: int = Field(0)
    uptime_seconds: float = Field(0.0)
    last_poll_utc: Optional[str] = Field(None)


# ═════════════════════════════════════════════════════════════════════
# TURNAROUND LOGIC ENGINE
# ═════════════════════════════════════════════════════════════════════

class TaskStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class TurnaroundTaskSchema(BaseModel):
    task_name: str = Field(..., description="refueling | cleaning | catering | baggage")
    status: TaskStatus = Field(TaskStatus.PENDING)
    estimated_duration_min: float = Field(0.0, description="Expected minutes to complete")
    started_at: Optional[str] = Field(None)
    completed_at: Optional[str] = Field(None)


class DelayPrediction(BaseModel):
    """Returned when the delay predictor detects risk."""
    at_risk: bool = Field(False)
    estimated_delay_minutes: float = Field(0.0)
    bottleneck_task: Optional[str] = Field(None, description="Task causing the delay")
    message: str = Field("")


class TurnaroundState(BaseModel):
    """Full turnaround timeline for a single flight."""
    flight_id: str
    landing_time: str
    target_departure_time: str
    is_completed: bool = False
    tasks: List[TurnaroundTaskSchema] = []
    delay_prediction: DelayPrediction = Field(default_factory=DelayPrediction)
    elapsed_minutes: float = Field(0.0, description="Minutes since landing")
    remaining_minutes: float = Field(0.0, description="Minutes until target departure")
    progress_percent: float = Field(0.0, ge=0.0, le=100.0)


class TaskUpdateRequest(BaseModel):
    """Payload for POST /api/turnaround/{flight_id}/update"""
    task_name: str = Field(..., description="refueling | cleaning | catering | baggage")
    status: TaskStatus = Field(..., description="PENDING | IN_PROGRESS | COMPLETED")


# ═════════════════════════════════════════════════════════════════════
# FUEL ANALYTICS
# ═════════════════════════════════════════════════════════════════════

class FuelAnalyticsResponse(BaseModel):
    """Returned by GET /api/analytics/{flight_id}."""
    flight_id: str = Field(..., description="Callsign / ICAO24 identifier")
    aircraft_type: str = Field("UNKNOWN", description="Matched aircraft type (A320, B737, B777, …)")
    total_fuel_kg: float = Field(0.0, description="Cumulative fuel burned in kg")
    total_cost_usd: float = Field(0.0, description="Fuel cost at $1.10/kg")
    total_co2_kg: float = Field(0.0, description="CO₂ emitted (3.16 × fuel kg)")
    current_altitude_ft: float = Field(0.0, description="Last-seen altitude in feet")
    current_velocity_kts: float = Field(0.0, description="Last-seen ground speed in knots")
    updated_every_seconds: int = Field(60, description="Analytics refresh interval in seconds")


class FuelAnalyticsSummary(BaseModel):
    """Aggregated fuel analytics across all tracked flights."""
    total_flights: int = Field(0, description="Number of flights being tracked")
    total_fuel_kg: float = Field(0.0, description="Combined fuel burned across all flights")
    total_cost_usd: float = Field(0.0, description="Combined fuel cost at $1.10/kg")
    total_co2_kg: float = Field(0.0, description="Combined CO₂ emitted")
    avg_fuel_per_flight_kg: float = Field(0.0, description="Average fuel per flight")
    avg_cost_per_flight_usd: float = Field(0.0, description="Average cost per flight")
    updated_every_seconds: int = Field(60, description="Analytics refresh interval in seconds")
