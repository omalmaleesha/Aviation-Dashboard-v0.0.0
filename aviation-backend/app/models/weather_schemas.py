"""
Schemas for weather integration endpoints.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class RouteCenter(BaseModel):
    lat: float = Field(..., description="Resolved route center latitude")
    lon: float = Field(..., description="Resolved route center longitude")


class WindyEmbedResponse(BaseModel):
    embedUrl: str
    center: RouteCenter | None = None
    resolvedFrom: str = Field(
        default="query",
        description="How the map center was resolved: query | flightRoute",
    )
