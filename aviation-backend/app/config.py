"""
SkyOps Sentinel — Central Configuration
All tunable constants live here.
Values are loaded from environment variables with sensible defaults.
"""

import os

from dotenv import load_dotenv

load_dotenv()  # reads .env file in project root (if present)

# ─── Base Airport (BIA / Colombo) ─────────────────────────────────────
BASE_AIRPORT_NAME = os.getenv("BASE_AIRPORT_NAME", "BIA")
BASE_AIRPORT_LAT = float(os.getenv("BASE_AIRPORT_LAT", "7.1801"))
BASE_AIRPORT_LNG = float(os.getenv("BASE_AIRPORT_LNG", "79.8841"))

# ─── OpenSky Network Bounding Box ────────────────────────────────────
# Format: (lat_min, lat_max, lng_min, lng_max)
BOUNDING_BOX_USA = (24.396308, 49.384358, -125.0, -66.93457)
BOUNDING_BOX_EUROPE = (35.0, 72.0, -25.0, 45.0)
BOUNDING_BOX_ASIA = (5.0, 55.0, 60.0, 150.0)

_BOUNDING_BOXES = {
    "USA": BOUNDING_BOX_USA,
    "EUROPE": BOUNDING_BOX_EUROPE,
    "ASIA": BOUNDING_BOX_ASIA,
}

# Active bounding box — set to "" or omit for WORLDWIDE coverage
_active_box_key = os.getenv("ACTIVE_BOUNDING_BOX", "ASIA").upper()
ACTIVE_BOUNDING_BOX = _BOUNDING_BOXES.get(_active_box_key, None)

# ─── Polling & Broadcast Intervals (seconds) ─────────────────────────
OPENSKY_POLL_INTERVAL = int(os.getenv("OPENSKY_POLL_INTERVAL", "60"))
WEBSOCKET_BROADCAST_INTERVAL = int(os.getenv("WEBSOCKET_BROADCAST_INTERVAL", "60"))

# ─── Chunked Broadcast (prevents network congestion at scale) ────────
BROADCAST_CHUNK_SIZE = 100       # flights per WebSocket frame

# ─── Aviation Thresholds ─────────────────────────────────────────────
DESCENDING_ALTITUDE_FT = 10_000  # feet
APPROACHING_DISTANCE_KM = 20    # kilometres
GEOFENCE_ALERT_DISTANCE_KM = 5  # arrival alert trigger radius

# ─── Alert Settings ──────────────────────────────────────────────────
ALERT_COOLDOWN_SECONDS = 60     # suppress repeat alerts for same flight
MAX_ALERT_HISTORY = 100         # keep last N alerts in memory

# ─── OpenSky API ─────────────────────────────────────────────────────
OPENSKY_API_URL = os.getenv("OPENSKY_API_URL", "https://opensky-network.org/api/states/all")
OPENSKY_USERNAME = os.getenv("OPENSKY_USERNAME", "")
OPENSKY_PASSWORD = os.getenv("OPENSKY_PASSWORD", "")

# ─── METAR Source ────────────────────────────────────────────────────
AVWX_METAR_URL = os.getenv("AVWX_METAR_URL", "https://aviationweather.gov/api/data/metar")

# ─── CORS — Frontend origins (comma-separated in .env) ──────────────
_cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ORIGINS = [origin.strip() for origin in _cors_raw.split(",") if origin.strip()]

# ─── Synthetic Data Defaults ─────────────────────────────────────────
MAX_SYNTHETIC_FLIGHTS = 1000

# ─── Turnaround Logic Engine ─────────────────────────────────────────
TURNAROUND_WINDOW_MINUTES = 45  # landing → target departure

# ─── Black Box Replay Service ────────────────────────────────────────
REPLAY_BUFFER_MINUTES = int(os.getenv("REPLAY_BUFFER_MINUTES", "30"))
# maxlen = REPLAY_BUFFER_MINUTES / (OPENSKY_POLL_INTERVAL / 60)
REPLAY_BUFFER_MAXLEN = int(REPLAY_BUFFER_MINUTES * 60 / OPENSKY_POLL_INTERVAL)

# ─── Fuel Analytics Service ──────────────────────────────────────────
FUEL_COST_PER_KG = float(os.getenv("FUEL_COST_PER_KG", "1.10"))
CO2_PER_KG_FUEL = float(os.getenv("CO2_PER_KG_FUEL", "3.16"))
FUEL_ANALYTICS_INTERVAL = int(os.getenv("FUEL_ANALYTICS_INTERVAL", "60"))

# Task durations in minutes (realistic ground-handling estimates)
TURNAROUND_TASKS = {
    "refueling":  {"duration_min": 20},
    "cleaning":   {"duration_min": 15},
    "catering":   {"duration_min": 18},
    "baggage":    {"duration_min": 25},
}
