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
| `JWT_SECRET_KEY` | auto-generated (dev fallback) | JWT signing secret (set explicitly in production) |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Access token TTL in minutes |
| `JWT_ISSUER` | `skyops-sentinel` | Expected JWT issuer claim |
| `JWT_AUDIENCE` | `skyops-api` | Expected JWT audience claim |
| `AUTH_MIN_PASSWORD_LENGTH` | `12` | Minimum password length for registration |
| `ENABLE_TEST_USER` | `true` | Seeds a development test user at startup |
| `TEST_USER_EMAIL` | `test.user@skyops.com` | Seeded development user email |
| `TEST_USER_PASSWORD` | `TestUser#2026!Secure` | Seeded development user password |
| `ENABLE_ADMIN_TEST_USER` | `true` | Seeds a development admin user at startup |
| `ADMIN_TEST_EMAIL` | `admin.test@skyops.com` | Seeded development admin email |
| `ADMIN_TEST_PASSWORD` | `Admin#2026!Secure` | Seeded development admin password |
| `APP_ENV` | `dev` | Runtime environment (`dev`/`prod`) used for weather auth defaults |
| `WINDY_EMBED_BASE_URL` | `https://embed.windy.com/embed2.html` | Windy embed base URL |
| `WINDY_API_KEY` | *(empty)* | Optional Windy API key for future premium integration |
| `WEATHER_WINDY_DEFAULT_ZOOM` | `6` | Default zoom level for `/api/weather/windy` |
| `WEATHER_WINDY_REQUIRE_AUTH` | `false` in dev, `true` in prod | Require JWT token for Windy endpoint |
| `WEATHER_WINDY_RATE_LIMIT_PER_MINUTE` | `60` | Per-IP request limit for Windy endpoint |

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
| `POST` | `/api/auth/register` | Create a user and return a JWT access token |
| `POST` | `/api/auth/login` | Authenticate with email/password and return JWT token |
| `POST` | `/api/auth/admin/login` | Authenticate admin user for admin panel access |
| `GET` | `/api/auth/me` | Return current authenticated user profile |
| `GET` | `/api/auth/admin/me` | Return current authenticated admin profile |
| `GET` | `/api/admin/overview` | Admin dashboard counters (users, sessions, incidents, alerts, health score) |
| `GET` | `/api/admin/users?limit=&offset=` | Paginated admin users table data |
| `PATCH` | `/api/admin/users/{user_id}/role` | Update user role from admin panel |
| `PATCH` | `/api/admin/users/{user_id}/active` | Enable/disable user account |
| `GET` | `/api/admin/incidents?status=open,investigating&limit=20` | Admin incidents list with optional status filter |
| `POST` | `/api/admin/incidents/{incident_id}/resolve` | Resolve an incident |
| `GET` | `/api/admin/audit-logs?limit=30&offset=0` | Paginated admin audit logs |
| `GET` | `/api/admin/system/metrics` | Admin system health metrics payload |
| `GET` | `/api/users/me` | Get editable profile details for logged-in user |
| `PATCH` | `/api/users/me` | Update profile fields (`full_name`, `role`, `timezone`, `contact_number`) |
| `GET` | `/api/settings/me` | Get app/system preference settings for logged-in user |
| `PATCH` | `/api/settings/me` | Partially update app/system preferences |
| `POST` | `/api/settings/me/reset` | Reset settings to backend defaults |
| `GET` | `/api/comms/overview` | Comms dashboard payload (channels, recent messages, unread count, incidents) |
| `POST` | `/api/comms/messages/{message_id}/ack` | Acknowledge a comms message (idempotent) |
| `GET` | `/api/comms/messages` | Filtered/paginated comms message history |
| `GET` | `/api/comms/channels` | Channel health/status list |
| `GET` | `/api/weather/windy` | Generate Windy embed URL dynamically (supports `lat/lon` or `flightId`) |
| `GET` | `/api/audit/timeline` | Incident timeline + audit log with filters/pagination |


### WebSocket

| Endpoint | Description |
|----------|-------------|
| `ws://localhost:8000/ws/flights` | Real-time chunked flight data stream |
| `ws://localhost:8000/ws/alerts` | Real-time geofence alert stream |
| `ws://localhost:8000/ws/comms` | Real-time comms events (`channel_health_update`, `message_created`, `message_acknowledged`, `incident_update`) |

---

## 🧠 Key Features

- **Geofence Alerts** — Automatic alerts when flights enter a 5 km radius around the base airport, with cooldown to prevent spam.
- **Turnaround Scheduling** — Auto-initiates ground handling (refueling, cleaning, catering, baggage) when flights approach. Predicts delays and identifies bottleneck tasks.
- **Fuel Analytics** — Physics-based fuel burn estimation using altitude/velocity factors, with real-time cost and CO₂ tracking per flight.
- **Synthetic Fallback** — Generates 800–1000 realistic flight objects when the OpenSky API is unreachable, so the frontend is never empty.
- **Chunked WebSocket** — Splits large flight payloads into 100-flight chunks to prevent network congestion.
- **JWT Authentication** — Secure register/login flow with hashed passwords, token expiry, issuer/audience validation, and protected profile endpoint.

---

## 🔐 Authentication Quick Check

On startup, the backend creates a dev test account (unless `ENABLE_TEST_USER=false`):

- **Email:** `test.user@skyops.com`
- **Password:** `TestUser#2026!Secure`

Use `/api/auth/login` to get a bearer token, then call `/api/auth/me` with `Authorization: Bearer <token>`.

### Admin Login (Frontend update)

Use these APIs for admin panel auth:

- `POST /api/auth/admin/login`
	- Body:
		- `email`
		- `password`
	- Success response includes:
		- `access_token`
		- `token_type`
		- `expires_in`
		- `user` with `is_admin=true`, `role`

- `GET /api/auth/admin/me`
	- Header: `Authorization: Bearer <token>`
	- Use this on app load/refresh to guard admin routes.

Suggested frontend flow:

1. Submit admin login form to `/api/auth/admin/login`.
2. Save returned token (same storage strategy you use for user login).
3. Route to admin panel only when `user.is_admin === true`.
4. On app init, call `/api/auth/admin/me`; if 401/403, clear token and redirect to admin login.

Admin dashboard data APIs (require admin bearer token):

- `GET /api/admin/overview`
	- Returns:
		- `overview.total_users`
		- `overview.active_sessions`
		- `overview.open_incidents`
		- `overview.unresolved_alerts`
		- `overview.system_health_score`
- `GET /api/admin/users?limit=50&offset=0`
	- Returns paginated user records for table rendering:
		- `items[]` with `id`, `email`, `role`, `is_admin`, `is_active`, `is_test_user`, `created_at`, `last_login_at`
		- `total`, `limit`, `offset`
- `PATCH /api/admin/users/{user_id}/role`
	- Body:
		- `role` (example: `OPERATOR`, `DISPATCHER`, `ADMIN`)
	- Returns:
		- `id`, `email`, `role`, `is_admin`, `is_active`
- `PATCH /api/admin/users/{user_id}/active`
	- Body:
		- `is_active` (boolean)
	- Returns:
		- `id`, `email`, `is_active`
- `GET /api/admin/incidents?status=open,investigating&limit=20`
	- Returns:
		- `items[]` with `id`, `title`, `severity`, `status`, `affected_system`, `created_at`, `owner`
- `POST /api/admin/incidents/{incident_id}/resolve`
	- Returns:
		- `id`, `status`, `resolved_at`, `resolved_by`
- `GET /api/admin/audit-logs?limit=30&offset=0`
	- Returns:
		- `items[]` with `id`, `actor_email`, `action`, `target`, `created_at`, `metadata`
		- `total`
- `GET /api/admin/system/metrics`
	- Returns:
		- `items[]` with metric cards such as `latency` and `error-rate` (`id`, `label`, `value`, `unit`, `status`)

### Windy Weather Embed (Frontend integration)

- `GET /api/weather/windy`
	- Query params:
		- `lat` (optional when `flightId` provided)
		- `lon` (optional when `flightId` provided)
		- `zoom` (optional, default from `WEATHER_WINDY_DEFAULT_ZOOM`)
		- `layer` (`wind`, `rain`, `clouds`, `pressure`)
		- `flightId` (optional: resolves center from route history)
	- Response:
		- `embedUrl`
		- `center` (present when `flightId` is used)
		- `resolvedFrom` (`query` or `flightRoute`)

Seeded development admin account (unless `ENABLE_ADMIN_TEST_USER=false`):

- **Email:** `admin.test@skyops.com`
- **Password:** `Admin#2026!Secure`

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
