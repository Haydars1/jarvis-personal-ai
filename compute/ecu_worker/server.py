from __future__ import annotations

import os

import httpx
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException

from .contracts import AnalysisJobInput
from .service import process_dispatched_job

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


@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "service": "jarvis-ecu-worker", "paid_api_required": False}


@app.post("/jobs", status_code=202)
async def submit_job(
    job: AnalysisJobInput,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    if not _authorized(authorization):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    token = _expected_token()
    background_tasks.add_task(_run_job, job, token)
    return {"accepted": True, "job_id": job.job_id, "operation": job.operation}
