"""
Black Box Replay — REST endpoint
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GET /api/replay              → list available time-keyframes
GET /api/replay?timestamp=T  → return the snapshot closest to T
"""

from __future__ import annotations

import logging
from typing import Optional, Union

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import ReplayKeyframesResponse, ReplaySnapshotResponse
from app.services.replay import replay_service

logger = logging.getLogger("skyops.routes.replay")

router = APIRouter(tags=["replay"])


@router.get(
    "/api/replay",
    response_model=Union[ReplaySnapshotResponse, ReplayKeyframesResponse],
    summary="Black-box time-series replay",
    description=(
        "Without `timestamp`: returns available keyframes.  "
        "With `timestamp` (ISO 8601): returns the snapshot closest to that instant."
    ),
)
async def replay(
    timestamp: Optional[str] = Query(
        default=None,
        description="ISO 8601 UTC timestamp to look up (e.g. 2026-02-27T14:30:00+00:00)",
    ),
):
    if timestamp is None:
        # ── No timestamp → return the list of available keyframes ──
        keyframes = await replay_service.get_keyframes()
        if keyframes.total_keyframes == 0:
            raise HTTPException(
                status_code=404,
                detail="Replay buffer is empty — no snapshots have been captured yet.",
            )
        return keyframes

    # ── Timestamp provided → find closest snapshot ───────────────
    result = await replay_service.get_snapshot_at(timestamp)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No matching snapshot found. "
                "The replay buffer may be empty or the timestamp is malformed. "
                "Use GET /api/replay (without timestamp) to list available keyframes."
            ),
        )
    return result
