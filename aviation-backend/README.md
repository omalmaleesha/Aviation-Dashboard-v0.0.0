# ✈️ SkyOps Sentinel

> Real-time aviation tracking backend powered by FastAPI — live flight data, geofence alerts, turnaround scheduling, and fuel analytics.

![Python](https://img.shields.io/badge/Python-3.12+-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.131+-009688?logo=fastapi&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 🏗️ Architecture — 4 Core Pillars

| # | Pillar | Description |
|---|--------|-------------|
| 1 | **Data Ingestion** | Polls [OpenSky Network](https://opensky-network.org/) every 60 s; falls back to synthetic data when the API is unreachable |
| 2 | **Aviation Logic** | Geofencing, status mapping (EN_ROUTE → DESCENDING → APPROACHING → ON_GROUND), and METAR weather decoding |
| 3 | **Real-Time Link** | Chunked WebSocket broadcasts to all connected frontend clients |
| 4 | **Reliability** | CORS, Pydantic type-safety, health checks, SQLite persistence |

---

## 📂 Project Structure

```
├── main.py                    # FastAPI entry point & lifespan manager
├── pyproject.toml             # Project metadata & dependencies
├── .env.example               # Sample environment variables
├── .gitignore
├── app/
│   ├── config.py              # Central configuration (reads from .env)
│   ├── database.py            # Async SQLAlchemy engine & session
│   ├── models/
│   │   ├── schemas.py         # Pydantic request/response models
│   │   └── turnaround_orm.py  # SQLAlchemy ORM models
│   ├── routes/
│   │   ├── alerts.py          # GET /api/alerts  ·  WS /ws/alerts
│   │   ├── flights.py         # GET /api/flights ·  WS /ws/flights
│   │   ├── fuel_analytics.py  # GET /api/analytics/*
│   │   ├── health.py          # GET /api/health
│   │   ├── metar.py           # GET /api/metar/{icao}
│   │   └── turnaround.py      # GET/POST /api/turnaround/*
│   └── services/
│       ├── alert_ws.py        # Alert WebSocket manager
│       ├── alerts.py          # Geofence alert logic
│       ├── aviation.py        # Status mapper, METAR decoder
│       ├── fuel_analytics.py  # Fuel burn / cost / CO₂ estimator
│       ├── opensky.py         # OpenSky poller + synthetic fallback
│       ├── turnaround.py      # Turnaround scheduling & delay predictor
│       └── websocket.py       # Flight WebSocket manager (chunked)
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.12+**
- **pip** or **uv** package manager

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/skyops-sentinel.git
cd skyops-sentinel
```

### 2. Create a virtual environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -e .
```

Or with **uv**:

```bash
uv sync
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your preferred settings. All values have sensible defaults so the app runs out of the box.

### 5. Run the server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at **http://localhost:8000**.  
Interactive docs at **http://localhost:8000/docs**.

---

## 🔑 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./skyops_sentinel.db` | Async database connection string |
| `BASE_AIRPORT_NAME` | `JFK` | Base airport ICAO code |
| `BASE_AIRPORT_LAT` | `40.6413` | Base airport latitude |
| `BASE_AIRPORT_LNG` | `-73.7781` | Base airport longitude |
| `OPENSKY_API_URL` | `https://opensky-network.org/api/states/all` | OpenSky Network API endpoint |
| `OPENSKY_USERNAME` | *(empty)* | OpenSky credentials (optional, for higher rate limits) |
| `OPENSKY_PASSWORD` | *(empty)* | OpenSky credentials (optional) |
| `ACTIVE_BOUNDING_BOX` | `ASIA` | Region filter: `USA`, `EUROPE`, `ASIA`, or empty for worldwide |
| `AVWX_METAR_URL` | `https://aviationweather.gov/api/data/metar` | METAR weather data source |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins |
| `OPENSKY_POLL_INTERVAL` | `60` | Seconds between OpenSky API polls |
| `WEBSOCKET_BROADCAST_INTERVAL` | `60` | Seconds between WebSocket broadcasts |
| `FUEL_COST_PER_KG` | `1.10` | Jet fuel cost in USD per kg |
| `CO2_PER_KG_FUEL` | `3.16` | kg CO₂ emitted per kg of fuel burned |
| `FUEL_ANALYTICS_INTERVAL` | `60` | Seconds between fuel analytics updates |

---

## 📡 API Endpoints

### REST

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | System health & connection status |
| `GET` | `/api/flights` | Snapshot of all tracked flights |
| `GET` | `/api/metar/{icao}` | Decoded METAR weather for an ICAO station |
| `GET` | `/api/alerts` | Recent geofence alert history |
| `GET` | `/api/turnaround/{flight_id}` | Turnaround timeline & delay prediction |
| `GET` | `/api/turnarounds` | All active turnarounds |
| `POST` | `/api/turnaround/{flight_id}/update` | Update a ground-handling task status |
| `GET` | `/api/analytics/summary` | Aggregated fuel/cost/CO₂ metrics |
| `GET` | `/api/analytics/{flight_id}` | Per-flight fuel analytics |
| `GET` | `/api/analytics` | Paginated list of all flight analytics |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `ws://localhost:8000/ws/flights` | Real-time chunked flight data stream |
| `ws://localhost:8000/ws/alerts` | Real-time geofence alert stream |

---

## 🧠 Key Features

- **Geofence Alerts** — Automatic alerts when flights enter a 5 km radius around the base airport, with cooldown to prevent spam.
- **Turnaround Scheduling** — Auto-initiates ground handling (refueling, cleaning, catering, baggage) when flights approach. Predicts delays and identifies bottleneck tasks.
- **Fuel Analytics** — Physics-based fuel burn estimation using altitude/velocity factors, with real-time cost and CO₂ tracking per flight.
- **Synthetic Fallback** — Generates 800–1000 realistic flight objects when the OpenSky API is unreachable, so the frontend is never empty.
- **Chunked WebSocket** — Splits large flight payloads into 100-flight chunks to prevent network congestion.

---

## 🛠️ Tech Stack

- **[FastAPI](https://fastapi.tiangolo.com/)** — Async web framework
- **[SQLAlchemy](https://www.sqlalchemy.org/)** (async) — ORM with SQLite via aiosqlite
- **[Pydantic](https://docs.pydantic.dev/)** — Data validation & serialization
- **[httpx](https://www.python-httpx.org/)** — Async HTTP client (OpenSky + METAR)
- **[geopy](https://geopy.readthedocs.io/)** — Geodesic distance calculations
- **[uvicorn](https://www.uvicorn.org/)** — ASGI server

---

## 📄 License

This project is licensed under the MIT License.
