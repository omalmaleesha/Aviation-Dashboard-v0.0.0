"""
SkyOps Sentinel — FastAPI Backend Entry Point
Wires together all 4 Core Pillars:
  1. Data Ingestion  (OpenSky poller + synthetic fallback)
  2. Aviation Logic   (Geofencing, Status Mapper, METAR)
  3. Real-Time Link   (WebSocket broadcast)
  4. Reliability       (CORS, Pydantic, Health Check)
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routes.flights import router as flights_router
from app.routes.health import router as health_router
from app.routes.metar import router as metar_router
from app.routes.alerts import router as alerts_router
from app.routes.turnaround import router as turnaround_router
from app.routes.fuel_analytics import router as fuel_analytics_router
from app.routes.replay import router as replay_router
from app.services.opensky import start_polling, stop_polling
from app.services.websocket import manager
from app.services.alert_ws import alert_manager
from app.services.fuel_analytics import start_fuel_analytics_loop, stop_fuel_analytics_loop
from app.database import init_db

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Register Routers ───────────────────────────────────────────────
app.include_router(flights_router)
app.include_router(metar_router)
app.include_router(health_router)
app.include_router(alerts_router)
app.include_router(turnaround_router)
app.include_router(fuel_analytics_router)
app.include_router(replay_router)


@app.get("/", tags=["root"])
async def root():
    return {"service": "SkyOps Sentinel", "version": "1.0.0", "status": "operational"}

