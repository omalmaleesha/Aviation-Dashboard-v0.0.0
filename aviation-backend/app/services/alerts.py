"""
Auto-Alert Geofence Service
Tracks flights entering the inner geofence (< 5 km) and emits
one-shot alerts with a cooldown so the frontend isn't spammed.
"""

from __future__ import annotations

import logging
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Deque, Dict, List

from app.config import (
    ALERT_COOLDOWN_SECONDS,
    BASE_AIRPORT_NAME,
    GEOFENCE_ALERT_DISTANCE_KM,
    MAX_ALERT_HISTORY,
)
from app.models.schemas import AlertSeverity, GeofenceAlert, FlightData

logger = logging.getLogger("skyops.alerts")

# ─── State ───────────────────────────────────────────────────────────
# Tracks last alert timestamp per flightId to enforce cooldown
_cooldowns: Dict[str, float] = {}

# Rolling history of recent alerts
_alert_history: Deque[GeofenceAlert] = deque(maxlen=MAX_ALERT_HISTORY)

# Alerts generated in the latest evaluation cycle (for broadcast)
_pending_alerts: List[GeofenceAlert] = []


# ─── Public Accessors ────────────────────────────────────────────────
def get_pending_alerts() -> List[GeofenceAlert]:
    """Return alerts generated since last call, then clear the buffer."""
    global _pending_alerts
    batch = list(_pending_alerts)
    _pending_alerts = []
    return batch


def get_alert_history() -> List[GeofenceAlert]:
    """Return the most recent N alerts (newest first)."""
    return list(reversed(_alert_history))


# ─── Core Logic ──────────────────────────────────────────────────────
def evaluate_geofence(flights: List[FlightData]) -> List[GeofenceAlert]:
    """
    Check every flight against the 5 km inner geofence.
    Fire an alert only if:
      1. distance_to_airport < GEOFENCE_ALERT_DISTANCE_KM
      2. Cooldown for that flightId has expired
    Returns newly generated alerts.
    """
    global _pending_alerts
    now = time.time()
    new_alerts: List[GeofenceAlert] = []

    for f in flights:
        if f.distance_to_airport > GEOFENCE_ALERT_DISTANCE_KM:
            # Flight left the zone → clear its cooldown so re-entry triggers again
            _cooldowns.pop(f.flightId, None)
            continue

        # Inside the 5 km zone — check cooldown
        last_fired = _cooldowns.get(f.flightId, 0.0)
        if now - last_fired < ALERT_COOLDOWN_SECONDS:
            continue  # still in cooldown, suppress

        # Determine severity
        if f.distance_to_airport < 2:
            severity = AlertSeverity.CRITICAL
        elif f.distance_to_airport < GEOFENCE_ALERT_DISTANCE_KM:
            severity = AlertSeverity.WARNING
        else:
            severity = AlertSeverity.INFO

        alert = GeofenceAlert(
            id=str(uuid.uuid4()),
            flightId=f.flightId,
            distance_km=round(f.distance_to_airport, 2),
            altitude=f.altitude,
            lat=f.lat,
            lng=f.lng,
            severity=severity,
            message=(
                f"🚨 ARRIVAL ALERT: {f.flightId} is {f.distance_to_airport:.1f} km "
                f"from {BASE_AIRPORT_NAME} at {f.altitude:.0f} ft"
            ),
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

        _cooldowns[f.flightId] = now
        _alert_history.append(alert)
        new_alerts.append(alert)
        logger.warning("GEOFENCE ALERT: %s", alert.message)

    _pending_alerts.extend(new_alerts)
    return new_alerts
