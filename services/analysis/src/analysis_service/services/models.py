from __future__ import annotations

from pydantic import BaseModel, Field


class EnqueueJobRequest(BaseModel):
    session_id: str = Field(..., description="UUID of the session row")


class JobResponse(BaseModel):
    session_id: str
    status: str


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str
