from __future__ import annotations

from typing import Any

from .analysis import analyze_binary
from .contracts import AnalysisJobInput, AnalysisJobOutput


async def process_dispatched_job(
    job: AnalysisJobInput,
    compute_token: str,
    *,
    client: Any,
) -> AnalysisJobOutput:
    base_url = str(job.config.get("callback_base_url") or "").rstrip("/")
    if not base_url:
        raise ValueError("callback_base_url is required")
    headers = {"authorization": f"Bearer {compute_token}"}

    state_url = f"{base_url}/api/ecu/internal/jobs/{job.job_id}/state"
    state_response = await client.post(
        state_url,
        headers={**headers, "content-type": "application/json"},
        json={"state": "RUNNING"},
    )
    state_response.raise_for_status()

    artifact_url = f"{base_url}/api/ecu/internal/artifacts/{job.artifact_sha256}"
    artifact_response = await client.get(artifact_url, headers=headers)
    artifact_response.raise_for_status()

    result = analyze_binary(job, bytes(artifact_response.content))

    callback_url = f"{base_url}/api/ecu/internal/jobs/{job.job_id}/result"
    callback_response = await client.post(
        callback_url,
        headers={**headers, "content-type": "application/json"},
        json=result.model_dump(),
    )
    callback_response.raise_for_status()
    return result
