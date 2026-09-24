from __future__ import annotations

from typing import Any

from .analysis import analyze_binary_with_artifact
from .contracts import AnalysisJobInput, AnalysisJobOutput
from .fingerprint import fingerprint_binary


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
        artifact_bytes=bytes(artifact_response.content)

        operation_label_map={
            "stage1_proposal":"stage1",
            "dtc_off_proposal":"dtc_off",
            "egr_off_proposal":"egr_off",
            "dpf_off_proposal":"dpf_off",
            "adblue_off_proposal":"adblue_off",
            "vmax_off_proposal":"vmax_off",
            "startstop_off_proposal":"startstop_off",
        }
        operation_label=operation_label_map.get(job.operation)
        if operation_label and not bool(effective_job.config.get("rulepack_verified")):
            fp=fingerprint_binary(artifact_bytes)
            hw=fp.hw_candidates[0] if fp.hw_candidates else ""
            sw=fp.sw_candidates[0] if fp.sw_candidates else ""
            params={
                "operationLabel":operation_label,
                "ecuFamily":fp.ecu_family,
                "hw":hw,
                "sw":sw,
            }
            from urllib.parse import urlencode
            rulepack_url=f"{base_url}/api/ecu/internal/rulepack?{urlencode(params)}"
            rulepack_response=await client.get(rulepack_url,headers=headers)
            if rulepack_response.status_code==200:
                payload=rulepack_response.json().get("rulepack") or {}
                effective_job=effective_job.model_copy(update={
                    "rulepack_version":str(payload.get("version") or effective_job.rulepack_version),
                    "config":{
                        **effective_job.config,
                        "rulepack_verified":True,
                        "rulepack":payload.get("rules") or {},
                        "operation_label":operation_label,
                        "ecu_family":fp.ecu_family,
                        "hw":hw,
                        "sw":sw,
                    },
                })
            elif rulepack_response.status_code not in {404}:
                rulepack_response.raise_for_status()

        fp_for_checksum=fingerprint_binary(artifact_bytes)
        hw_for_checksum=fp_for_checksum.hw_candidates[0] if fp_for_checksum.hw_candidates else ""
        sw_for_checksum=fp_for_checksum.sw_candidates[0] if fp_for_checksum.sw_candidates else ""
        from urllib.parse import urlencode
        checksum_url=f"{base_url}/api/ecu/internal/checksum-profile?{urlencode({
            'ecuFamily':fp_for_checksum.ecu_family,
            'hw':hw_for_checksum,
            'sw':sw_for_checksum,
        })}"
        checksum_response=await client.get(checksum_url,headers=headers)
        if checksum_response.status_code==200:
            profile=checksum_response.json().get("profile") or {}
            effective_job=effective_job.model_copy(update={
                "config":{**effective_job.config,"checksum_profile":profile},
            })
        elif checksum_response.status_code not in {404}:
            checksum_response.raise_for_status()

        result, mod_bytes, checksum_algorithm = analyze_binary_with_artifact(effective_job, artifact_bytes)
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
