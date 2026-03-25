from __future__ import annotations

from fastapi import Depends, FastAPI, Header, HTTPException, status

from analysis_service.config import settings
from analysis_service.services.models import EnqueueJobRequest, HealthResponse, JobResponse
from analysis_service.services.queue import enqueue_analysis_job


app = FastAPI(title=settings.app_name)


def verify_token(authorization: str | None = Header(default=None)) -> None:
    expected = f"Bearer {settings.analysis_api_token}"
    if authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(service=settings.app_name)


@app.post("/v1/jobs/analyze", response_model=JobResponse, dependencies=[Depends(verify_token)])
def enqueue_job(payload: EnqueueJobRequest) -> JobResponse:
    enqueue_analysis_job(payload.session_id)
    return JobResponse(session_id=payload.session_id, status="queued")
