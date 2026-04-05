"""
SkyOps Sentinel — FastAPI Backend Entry Point
Wires together all 4 Core Pillars:
  1. Data Ingestion  (OpenSky poller + synthetic fallback)
  2. Aviation Logic   (Geofencing, Status Mapper, METAR)
  3. Real-Time Link   (WebSocket broadcast)
  4. Reliability       (CORS, Pydantic, Health Check)
"""

#uv run fastapi dev

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routes.flights import router as flights_router
from app.routes.health import router as health_router
from app.routes.metar import router as metar_router
from app.routes.alerts import router as alerts_router
from app.routes.turnaround import router as turnaround_router
from app.routes.fuel_analytics import router as fuel_analytics_router
from app.routes.replay import router as replay_router
from app.routes.aircraft_types import router as aircraft_types_router
from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.settings import router as settings_router
from app.routes.comms import router as comms_router
from app.services.opensky import start_polling, stop_polling
from app.services.websocket import manager
from app.services.alert_ws import alert_manager
from app.services.fuel_analytics import start_fuel_analytics_loop, stop_fuel_analytics_loop
from app.database import async_session, init_db
from app.services.auth import seed_test_user

# ─── Logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-22s | %(levelname)-7s | %(message)s",
)
logger = logging.getLogger("skyops.main")


# ─── Lifespan: start/stop background tasks ──────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Spin up the data-ingestion poller and broadcast loop on startup."""
    logger.info("🛫  SkyOps Sentinel starting up…")
    await init_db()
    logger.info("📦  SQLite database initialized")
    async with async_session() as session:
        seeded_user = await seed_test_user(session)
        if seeded_user is not None:
            logger.info("🔐 Test user ready: %s", seeded_user.email)
    poller_task = asyncio.create_task(start_polling())
    broadcast_task = asyncio.create_task(manager.start_broadcast_loop())
    alert_task = asyncio.create_task(alert_manager.start_broadcast_loop())
    fuel_task = asyncio.create_task(start_fuel_analytics_loop())
    yield
    logger.info("🛬  SkyOps Sentinel shutting down…")
    await stop_polling()
    await manager.stop_broadcast_loop()
    await alert_manager.stop_broadcast_loop()
    await stop_fuel_analytics_loop()
    poller_task.cancel()
    broadcast_task.cancel()
    alert_task.cancel()
    fuel_task.cancel()


# ─── App Factory ─────────────────────────────────────────────────────
app = FastAPI(
    title="SkyOps Sentinel",
    description="Real-time aviation tracking backend",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS Middleware (Pillar 4) ──────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
    detail = []
    for error in exc.errors():
        loc = error.get("loc", [])
        field = str(loc[-1]) if loc else "body"
        detail.append({"field": field, "message": error.get("msg", "Invalid value")})
    return JSONResponse(status_code=422, content={"detail": detail})

# ─── Register Routers ───────────────────────────────────────────────
app.include_router(flights_router)
app.include_router(metar_router)
app.include_router(health_router)
app.include_router(alerts_router)
app.include_router(turnaround_router)
app.include_router(fuel_analytics_router)
app.include_router(replay_router)
app.include_router(aircraft_types_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(settings_router)
app.include_router(comms_router)


@app.get("/", tags=["root"])
async def root():
    return {"service": "SkyOps Sentinel", "version": "1.0.0", "status": "operational"}

