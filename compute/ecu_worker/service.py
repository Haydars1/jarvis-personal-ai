from __future__ import annotations

from typing import Any

from .analysis import analyze_binary_with_artifact
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

    callback_url = f"{base_url}/api/ecu/internal/jobs/{job.job_id}/result"
    try:
        effective_job = job
        if job.model_version and job.model_version != "baseline":
            model_url = f"{base_url}/api/ecu/internal/models/{job.model_version}"
            model_response = await client.get(model_url, headers=headers)
            model_response.raise_for_status()
            model_json = model_response.content.decode("utf-8")
            effective_job = job.model_copy(update={
                "config": {**job.config, "semantic_model_json": model_json},
            })

        artifact_url = f"{base_url}/api/ecu/internal/artifacts/{job.artifact_sha256}"
        artifact_response = await client.get(artifact_url, headers=headers)
        artifact_response.raise_for_status()

        result, mod_bytes, checksum_algorithm = analyze_binary_with_artifact(effective_job, bytes(artifact_response.content))
        callback_response = await client.post(
            callback_url,
            headers={**headers, "content-type": "application/json"},
            json=result.model_dump(),
        )
        callback_response.raise_for_status()
        if result.status == "READY" and mod_bytes is not None and checksum_algorithm:
            mod_url = f"{base_url}/api/ecu/internal/jobs/{job.job_id}/mod"
            mod_response = await client.post(
                mod_url,
                headers={**headers, "content-type": "application/octet-stream", "x-checksum-algorithm": checksum_algorithm},
                content=mod_bytes,
            )
            mod_response.raise_for_status()
        return result
    except Exception as exc:
        from .contracts import build_run_fingerprint
        failed = {
            "job_id": job.job_id,
            "run_fingerprint": build_run_fingerprint(
                job.artifact_sha256,
                job.model_version,
                job.rulepack_version,
                job.config,
                operation=job.operation,
            ),
            "status": "FAILED",
            "ecu_family": "UNKNOWN",
            "hw_candidates": [],
            "sw_candidates": [],
            "supported": False,
            "confidence": 0.0,
            "evidence": [],
            "map_candidates": [],
            "error": f"{type(exc).__name__}: {exc}"[:500],
        }
        try:
            await client.post(
                callback_url,
                headers={**headers, "content-type": "application/json"},
                json=failed,
            )
        finally:
            raise
