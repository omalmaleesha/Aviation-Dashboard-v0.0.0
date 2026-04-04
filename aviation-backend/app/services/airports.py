"""Airport helpers for zero-cost route enrichment.

Provides:
  • static ICAO → coordinates lookup (free, local)
  • nearest-airport lookup
  • heading-based origin/destination inference
"""

from __future__ import annotations

import math
from typing import Dict, Optional, Tuple

from geopy.distance import geodesic

from app.config import BASE_AIRPORT_LAT, BASE_AIRPORT_LNG


AIRPORT_COORDS: Dict[str, Tuple[float, float]] = {
    "VDPP": (11.5466, 104.8441),
    "VDSR": (13.4107, 103.8138),
    "WSSS": (1.3644, 103.9915),
    "VTBS": (13.6900, 100.7501),
    "WMKK": (2.7456, 101.7099),
    "RPLL": (14.5086, 121.0198),
    "WIII": (-6.1256, 106.6559),
    "VHHH": (22.3080, 113.9185),
    "RJTT": (35.5494, 139.7798),
    "RKSI": (37.4602, 126.4407),
    "VIDP": (28.5562, 77.1000),
    "VOMM": (12.9941, 80.1709),
    "VCBI": (7.1808, 79.8841),
    "VRMM": (16.9073, 96.1332),
    "ZPPP": (25.1019, 102.9292),
    "VTSB": (9.1326, 99.1356),
    "VTSP": (8.1132, 98.3169),
    "RPVM": (10.6425, 122.9290),
    "WADD": (-8.7482, 115.1672),
    "VYYY": (16.9072, 96.1330),
    "BASE": (BASE_AIRPORT_LAT, BASE_AIRPORT_LNG),
}


def get_airport_coords(icao: Optional[str]) -> Optional[Tuple[float, float]]:
    if not icao:
        return None
    return AIRPORT_COORDS.get(icao.strip().upper())


def find_nearest_airport(lat: float, lng: float) -> Optional[str]:
    best_icao: Optional[str] = None
    best_distance = float("inf")
    for icao, (a_lat, a_lng) in AIRPORT_COORDS.items():
        d_km = geodesic((lat, lng), (a_lat, a_lng)).km
        if d_km < best_distance:
            best_distance = d_km
            best_icao = icao
    return best_icao


def _initial_bearing(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> float:
    """Return bearing in degrees from point A to B."""
    lat1 = math.radians(from_lat)
    lat2 = math.radians(to_lat)
    delta_lng = math.radians(to_lng - from_lng)

    x = math.sin(delta_lng) * math.cos(lat2)
    y = (
        math.cos(lat1) * math.sin(lat2)
        - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lng)
    )
    bearing = math.degrees(math.atan2(x, y))
    return (bearing + 360.0) % 360.0


def _angular_diff(a: float, b: float) -> float:
    return abs((a - b + 180.0) % 360.0 - 180.0)


def infer_origin_destination(
    lat: float,
    lng: float,
    heading_deg: float,
    speed_kts: float,
) -> Tuple[Optional[str], Optional[str]]:
    """Infer origin/destination using heading + nearest-airport heuristics.

    This method is fully local and free, intended as a best-effort fallback.
    """
    nearest = find_nearest_airport(lat, lng)
    if nearest is None:
        return None, None

    candidates = []
    for icao, (a_lat, a_lng) in AIRPORT_COORDS.items():
        bearing = _initial_bearing(lat, lng, a_lat, a_lng)
        distance_km = geodesic((lat, lng), (a_lat, a_lng)).km
        candidates.append((icao, bearing, distance_km))

    if not candidates:
        return nearest, nearest

    # Slow / near-ground flights: best guess is local airport for both.
    if speed_kts < 80:
        return nearest, nearest

    reverse_heading = (heading_deg + 180.0) % 360.0

    destination_ranked = sorted(
        candidates,
        key=lambda c: _angular_diff(heading_deg, c[1]) + min(c[2] / 8.0, 120.0),
    )
    origin_ranked = sorted(
        candidates,
        key=lambda c: _angular_diff(reverse_heading, c[1]) + min(c[2] / 8.0, 120.0),
    )

    destination = destination_ranked[0][0]
    origin = origin_ranked[0][0]

    if origin == destination and len(origin_ranked) > 1:
        origin = origin_ranked[1][0]

    return origin, destination
