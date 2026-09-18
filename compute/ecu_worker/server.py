from __future__ import annotations

import os

import httpx
from typing import Any

from fastapi import BackgroundTasks, Body, FastAPI, Header, HTTPException

from .contracts import AnalysisJobInput, TrainingJobInput
from .service import process_dispatched_job
from .training_service import process_training_job

app = FastAPI(title="JARVIS ECU Worker", version="0.1.0")


def _expected_token() -> str:
    return os.getenv("ECU_COMPUTE_TOKEN", "").strip()


def _authorized(authorization: str | None) -> bool:
    expected = _expected_token()
    if not expected:
        return False
    return authorization == f"Bearer {expected}"


async def _run_job(job: AnalysisJobInput, token: str) -> None:
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=15.0)) as client:
        await process_dispatched_job(job, token, client=client)


async def _run_training(job: TrainingJobInput, token: str) -> None:
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=15.0)) as client:
        await process_training_job(job, token, client=client)


@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "service": "jarvis-ecu-worker", "paid_api_required": False}


@app.post("/jobs", status_code=202)
async def submit_job(
    background_tasks: BackgroundTasks,
    payload: dict[str, Any] = Body(...),
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    if not _authorized(authorization):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    token = _expected_token()
    operation = str(payload.get("operation") or "analyze")
    if operation == "train":
        job = TrainingJobInput.model_validate(payload)
        background_tasks.add_task(_run_training, job, token)
    else:
        job = AnalysisJobInput.model_validate(payload)
        background_tasks.add_task(_run_job, job, token)
    return {"accepted": True, "job_id": job.job_id, "operation": operation}
