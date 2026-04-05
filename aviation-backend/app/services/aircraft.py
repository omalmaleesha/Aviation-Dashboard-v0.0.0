"""Free, local aircraft type inference heuristics.

No paid/external API calls. This is a best-effort estimator based on
callsign patterns and simple flight dynamics.
"""

from __future__ import annotations

from typing import Optional


def infer_aircraft_type(
    flight_id: str,
    speed_kts: Optional[float] = None,
    altitude_ft: Optional[float] = None,
) -> str:
    upper = (flight_id or "").upper()

    # Explicit hints in IDs/callsigns
    if "B777" in upper or "77W" in upper:
        return "B777"
    if "B737" in upper or "73" in upper:
        return "B737"
    if "A320" in upper or "320" in upper:
        return "A320"

    # Airline-level heuristics for common fleets in this region
    if upper.startswith(("IGO", "AIC", "AXM", "VJC", "JSA")):
        return "A320"
    if upper.startswith(("RYR", "SWA", "KAL", "PAL")):
        return "B737"
    if upper.startswith(("UAE", "QTR", "SIA", "BAW", "CPA", "ANA")):
        return "B777"

    # Dynamics fallback when callsign has no clues
    speed = float(speed_kts or 0.0)
    alt = float(altitude_ft or 0.0)

    if speed > 470 or alt > 38000:
        return "B777"
    if speed > 430:
        return "B737"
    if speed > 0:
        return "A320"

    return "UNKNOWN"
