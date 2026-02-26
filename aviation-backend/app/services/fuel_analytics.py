"""
Fuel Analytics Service — estimates fuel burn, cost, and CO₂ emissions
for every tracked flight, updated every 10 seconds in sync with the
OpenSky polling loop.

Physics model (simplified):
  burn_rate_kg_per_s = base_rate × altitude_factor × velocity_factor
  altitude_factor    = 1.0 at sea-level, dropping to ~0.6 at cruise (thin air)
  velocity_factor    = (v / v_cruise)²  — drag rises with the square of speed
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Dict, Optional

from app.config import (
    FUEL_COST_PER_KG,
    CO2_PER_KG_FUEL,
    FUEL_ANALYTICS_INTERVAL,
)
from app.services.opensky import get_current_flights

logger = logging.getLogger("skyops.fuel_analytics")


# ═══════════════════════════════════════════════════════════════════════
# BURN-RATE DICTIONARY  (kg / second at cruise conditions)
# ═══════════════════════════════════════════════════════════════════════
BURN_RATES: Dict[str, dict] = {
    "A320": {
        "base_burn_kg_s": 0.80,     # ~2 880 kg/h at cruise
        "cruise_altitude_ft": 37_000,
        "cruise_velocity_kts": 450,
    },
    "B737": {
        "base_burn_kg_s": 0.75,     # ~2 700 kg/h at cruise
        "cruise_altitude_ft": 35_000,
        "cruise_velocity_kts": 460,
    },
    "B777": {
        "base_burn_kg_s": 2.40,     # ~8 640 kg/h at cruise
        "cruise_altitude_ft": 40_000,
        "cruise_velocity_kts": 490,
    },
}

# Fallback profile used when the aircraft type is unknown
_DEFAULT_PROFILE = {
    "base_burn_kg_s": 1.0,
    "cruise_altitude_ft": 36_000,
    "cruise_velocity_kts": 460,
}


# ═══════════════════════════════════════════════════════════════════════
# PHYSICS — calculate_burn()
# ═══════════════════════════════════════════════════════════════════════

def _resolve_profile(flight_id: str) -> dict:
    """
    Try to match a flight-ID / callsign to a known aircraft type.
    Real-world approach: query an aircraft-type DB.
    Heuristic: check if the callsign prefix hints at narrow/wide-body.
    Falls back to the default profile.
    """
    upper = flight_id.upper()
    for type_key, profile in BURN_RATES.items():
        if type_key in upper:
            return profile
    # Heuristic — heavy operators → B777 profile, others → A320
    heavy_prefixes = ("UAE", "BAW", "QTR", "SIA", "CPA", "ANA")
    if any(upper.startswith(p) for p in heavy_prefixes):
        return BURN_RATES["B777"]
    return _DEFAULT_PROFILE


def calculate_burn(
    altitude_ft: float,
    velocity_kts: float,
    time_delta_s: float,
    profile: dict | None = None,
) -> float:
    """
    Estimate fuel burned (kg) over *time_delta_s* seconds.

    Parameters
    ----------
    altitude_ft : float   Current barometric altitude in feet.
    velocity_kts : float  Current ground speed in knots.
    time_delta_s : float  Elapsed time window in seconds.
    profile      : dict   Aircraft burn-rate profile (from BURN_RATES).

    Returns
    -------
    float  Estimated fuel consumed in kilograms.
    """
    if profile is None:
        profile = _DEFAULT_PROFILE

    base_rate = profile["base_burn_kg_s"]
    cruise_alt = profile["cruise_altitude_ft"]
    cruise_vel = profile["cruise_velocity_kts"]

    # ── altitude factor ──────────────────────────────────────────────
    # At sea-level, engines burn ~40 % more than at cruise altitude
    # because of denser air.  Linear interpolation 1.4 → 0.6.
    alt_ratio = min(altitude_ft / cruise_alt, 1.0) if cruise_alt else 0.0
    altitude_factor = 1.4 - 0.8 * alt_ratio          # 1.4 at ground → 0.6 at cruise

    # ── velocity factor ──────────────────────────────────────────────
    # Drag ∝ v².  Normalise to cruise speed so factor = 1.0 at cruise.
    v_ratio = (velocity_kts / cruise_vel) if cruise_vel else 0.0
    velocity_factor = max(v_ratio ** 2, 0.1)          # floor to avoid zero

    burn_kg = base_rate * altitude_factor * velocity_factor * time_delta_s
    return round(burn_kg, 4)


# ═══════════════════════════════════════════════════════════════════════
# IN-MEMORY ANALYTICS STORE  (flight_id → cumulative metrics)
# ═══════════════════════════════════════════════════════════════════════

class _FuelRecord:
    """Running totals for a single flight."""

    __slots__ = (
        "flight_id", "aircraft_type", "total_fuel_kg",
        "total_cost_usd", "total_co2_kg", "last_altitude_ft",
        "last_velocity_kts", "last_updated",
    )

    def __init__(self, flight_id: str, aircraft_type: str) -> None:
        self.flight_id = flight_id
        self.aircraft_type = aircraft_type
        self.total_fuel_kg: float = 0.0
        self.total_cost_usd: float = 0.0
        self.total_co2_kg: float = 0.0
        self.last_altitude_ft: float = 0.0
        self.last_velocity_kts: float = 0.0
        self.last_updated: float = time.monotonic()


# flight_id → _FuelRecord
_analytics_store: Dict[str, _FuelRecord] = {}


def get_analytics(flight_id: str) -> Optional[_FuelRecord]:
    """Return the current fuel analytics for a flight, or None."""
    return _analytics_store.get(flight_id)


def get_all_analytics() -> Dict[str, _FuelRecord]:
    """Return the full analytics store (read-only snapshot)."""
    return dict(_analytics_store)


# ═══════════════════════════════════════════════════════════════════════
# BACKGROUND UPDATER — runs every 10 seconds alongside the poller
# ═══════════════════════════════════════════════════════════════════════

_running: bool = False


async def start_fuel_analytics_loop() -> None:
    """
    Continuously re-compute fuel metrics for every tracked flight.
    Designed to run as an ``asyncio.create_task`` in the FastAPI lifespan.
    """
    global _running
    _running = True
    logger.info(
        "Fuel-analytics loop started (interval=%ds)", FUEL_ANALYTICS_INTERVAL
    )

    while _running:
        try:
            _update_all_flights()
        except Exception as exc:
            logger.error("Fuel-analytics tick failed: %s", exc)
        await asyncio.sleep(FUEL_ANALYTICS_INTERVAL)


async def stop_fuel_analytics_loop() -> None:
    global _running
    _running = False
    logger.info("Fuel-analytics loop stopped")


def _update_all_flights() -> None:
    """One tick: iterate current flights and accumulate fuel burn."""
    now = time.monotonic()
    flights = get_current_flights()
    active_ids = set()

    for f in flights:
        active_ids.add(f.flightId)
        rec = _analytics_store.get(f.flightId)

        if rec is None:
            # First sighting — create record, no burn yet
            profile = _resolve_profile(f.flightId)
            ac_type = next(
                (k for k, v in BURN_RATES.items() if v is profile),
                "UNKNOWN",
            )
            rec = _FuelRecord(f.flightId, ac_type)
            _analytics_store[f.flightId] = rec
            rec.last_altitude_ft = f.altitude
            rec.last_velocity_kts = f.speed
            rec.last_updated = now
            continue

        # Compute time elapsed since last tick
        dt = now - rec.last_updated
        if dt <= 0:
            continue

        profile = _resolve_profile(f.flightId)
        fuel_kg = calculate_burn(f.altitude, f.speed, dt, profile)

        rec.total_fuel_kg += fuel_kg
        rec.total_cost_usd = round(rec.total_fuel_kg * FUEL_COST_PER_KG, 2)
        rec.total_co2_kg = round(rec.total_fuel_kg * CO2_PER_KG_FUEL, 2)
        rec.last_altitude_ft = f.altitude
        rec.last_velocity_kts = f.speed
        rec.last_updated = now

    # Prune flights that have disappeared from the feed (keep data for 5 min)
    stale_cutoff = now - 300
    stale_ids = [
        fid for fid, rec in _analytics_store.items()
        if fid not in active_ids and rec.last_updated < stale_cutoff
    ]
    for fid in stale_ids:
        del _analytics_store[fid]
