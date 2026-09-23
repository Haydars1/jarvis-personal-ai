from __future__ import annotations

import asyncio
import hmac
import os
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone

import httpx
from typing import Any

from fastapi import BackgroundTasks, Body, FastAPI, Header, HTTPException

from .contracts import AnalysisJobInput, PairJobInput, TrainingJobInput
from .heartbeat_daemon import heartbeat_config_from_env, run_heartbeat_loop
from .service import process_dispatched_job
from .pair_service import process_pair_job
from .training_service import process_training_job


_heartbeat_state: dict[str, object] = {
    "enabled": False,
    "running": False,
    "healthy": None,
    "last_success_at": None,
    "last_error_at": None,
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _local_heartbeat_enabled() -> bool:
    return os.getenv("ECU_LOCAL_HEARTBEAT_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}


def _heartbeat_success() -> None:
    _heartbeat_state["healthy"] = True
    _heartbeat_state["last_success_at"] = _utc_now()


def _heartbeat_failure(_: Exception) -> None:
    _heartbeat_state["healthy"] = False
    _heartbeat_state["last_error_at"] = _utc_now()


@asynccontextmanager
async def _lifespan(_: FastAPI):
    heartbeat_task: asyncio.Task[None] | None = None
    heartbeat_client: httpx.AsyncClient | None = None
    enabled = _local_heartbeat_enabled()
    _heartbeat_state.update(
        enabled=enabled,
        running=False,
        healthy=None,
        last_success_at=None,
        last_error_at=None,
    )
    if enabled:
        config = heartbeat_config_from_env()
        heartbeat_client = httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=10.0))
        heartbeat_task = asyncio.create_task(
            run_heartbeat_loop(
                client=heartbeat_client,
                on_success=_heartbeat_success,
                on_failure=_heartbeat_failure,
                **config,
            ),
            name="ecu-local-heartbeat",
        )
        _heartbeat_state["running"] = True
    try:
        yield
    finally:
        _heartbeat_state["running"] = False
        if heartbeat_task is not None:
            heartbeat_task.cancel()
            with suppress(asyncio.CancelledError):
                await heartbeat_task
        if heartbeat_client is not None:
            await heartbeat_client.aclose()


app = FastAPI(title="JARVIS ECU Worker", version="0.1.0", lifespan=_lifespan)


def _expected_token() -> str:
    return os.getenv("ECU_COMPUTE_TOKEN", "").strip()


def _authorized(authorization: str | None) -> bool:
    expected = _expected_token()
    if not expected or authorization is None:
        return False
    return hmac.compare_digest(authorization, f"Bearer {expected}")


async def _run_job(job: AnalysisJobInput, token: str) -> None:
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=15.0)) as client:
        await process_dispatched_job(job, token, client=client)


async def _run_pair(job: PairJobInput, token: str) -> None:
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0)) as client:
        await process_pair_job(job, token, client=client)


async def _run_training(job: TrainingJobInput, token: str) -> None:
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=15.0)) as client:
        await process_training_job(job, token, client=client)


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "ok": True,
        "service": "jarvis-ecu-worker",
        "paid_api_required": False,
        "heartbeat": dict(_heartbeat_state),
    }


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
    elif operation == "diff_pair":
        job = PairJobInput.model_validate(payload)
        background_tasks.add_task(_run_pair, job, token)
    else:
        job = AnalysisJobInput.model_validate(payload)
        background_tasks.add_task(_run_job, job, token)
    return {"accepted": True, "job_id": job.job_id, "operation": operation}
