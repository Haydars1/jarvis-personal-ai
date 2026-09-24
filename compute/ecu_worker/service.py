from __future__ import annotations

from typing import Any

from .analysis import analyze_binary_with_artifact
from .contracts import AnalysisJobInput, AnalysisJobOutput, build_run_fingerprint
from .fingerprint import fingerprint_binary
from .rulepack_select import select_rulepack_for_binary

OPERATION_LABEL_MAP={
    "stage1_proposal":"stage1",
    "dtc_off_proposal":"dtc_off",
    "egr_off_proposal":"egr_off",
    "dpf_off_proposal":"dpf_off",
    "adblue_off_proposal":"adblue_off",
    "vmax_off_proposal":"vmax_off",
    "startstop_off_proposal":"startstop_off",
}



async def _resolve_operation_job(
    job: AnalysisJobInput,
    artifact_bytes: bytes,
    *,
    operation: str,
    base_url: str,
    headers: dict[str, str],
    client: Any,
) -> AnalysisJobInput:
    operation_label=OPERATION_LABEL_MAP.get(operation)
    effective=job.model_copy(update={"operation":operation})
    if not operation_label:
        return effective

    if bool(effective.config.get("rulepack_verified")) and effective.operation==operation:
        return effective

    fp=fingerprint_binary(artifact_bytes)
    hw=fp.hw_candidates[0] if fp.hw_candidates else ""
    sw=fp.sw_candidates[0] if fp.sw_candidates else ""
    from urllib.parse import urlencode
    params={
        "operationLabel":operation_label,
        "ecuFamily":fp.ecu_family,
        "hw":hw,
        "sw":sw,
    }
    candidates_url=f"{base_url}/api/ecu/internal/rulepack-candidates?{urlencode(params)}"
    response=await client.get(candidates_url,headers=headers)
    config={
        **effective.config,
        "rulepack_verified":False,
        "operation_label":operation_label,
        "ecu_family":fp.ecu_family,
        "hw":hw,
        "sw":sw,
    }
    rulepack_version=effective.rulepack_version
    if response.status_code==200:
        candidates=response.json().get("candidates") or []
        selection=select_rulepack_for_binary(
            artifact_bytes,
            candidates,
            operation_label=operation_label,
        )
        payload=selection.candidate or {}
        config.update({
            "rulepack_selection_reason":selection.reason,
            "rulepack_compatible_count":selection.compatible_count,
        })
        if payload:
            rulepack_version=str(payload.get("version") or rulepack_version)
            config.update({
                "rulepack_verified":True,
                "rulepack":payload.get("rules") or {},
                "rulepack_portable":bool(payload.get("portable")),
                "rulepack_source_sw":str(payload.get("sourceSw") or ""),
            })
    elif response.status_code not in {404}:
        response.raise_for_status()

    return effective.model_copy(update={
        "operation":operation,
        "rulepack_version":rulepack_version,
        "config":config,
    })


async def _inject_checksum_profile(
    job: AnalysisJobInput,
    artifact_bytes: bytes,
    *,
    base_url: str,
    headers: dict[str, str],
    client: Any,
) -> AnalysisJobInput:
    fp=fingerprint_binary(artifact_bytes)
    hw=fp.hw_candidates[0] if fp.hw_candidates else ""
    sw=fp.sw_candidates[0] if fp.sw_candidates else ""
    from urllib.parse import urlencode
    checksum_url=f"{base_url}/api/ecu/internal/checksum-profile?{urlencode({
        'ecuFamily':fp.ecu_family,
        'hw':hw,
        'sw':sw,
    })}"
    response=await client.get(checksum_url,headers=headers)
    if response.status_code==200:
        profile=response.json().get("profile") or {}
        return job.model_copy(update={
            "config":{**job.config,"checksum_profile":profile},
        })
    if response.status_code not in {404}:
        response.raise_for_status()
    return job


async def _process_composite(
    job: AnalysisJobInput,
    artifact_bytes: bytes,
    *,
    base_url: str,
    headers: dict[str, str],
    client: Any,
) -> tuple[AnalysisJobOutput, bytes | None, str | None]:
    operations=[
        str(value)
        for value in (job.config.get("service_operations") or [])
        if str(value) in OPERATION_LABEL_MAP
    ]
    if not operations:
        raise ValueError("COMPOSITE_OPERATIONS_REQUIRED")

    working=artifact_bytes
    children=[]
    map_candidates=[]
    last_checksum_algorithm=None
    final_result=None

    for operation in operations:
        child=await _resolve_operation_job(
            job,
            working,
            operation=operation,
            base_url=base_url,
            headers=headers,
            client=client,
        )
        child=await _inject_checksum_profile(
            child,
            working,
            base_url=base_url,
            headers=headers,
            client=client,
        )
        result,mod_bytes,checksum_algorithm=analyze_binary_with_artifact(child,working)
        children.append({
            "operation":operation,
            "status":result.status,
            "proposal":result.proposal,
            "rulepack_version":child.rulepack_version,
            "selection_reason":child.config.get("rulepack_selection_reason"),
        })
        if result.map_candidates and not map_candidates:
            map_candidates=result.map_candidates
        final_result=result
        if result.status!="READY" or mod_bytes is None or not checksum_algorithm:
            fp=fingerprint_binary(artifact_bytes)
            reasons=[]
            if isinstance(result.proposal,dict):
                reasons.extend(str(value) for value in (result.proposal.get("reasons") or []))
            output=AnalysisJobOutput(
                job_id=job.job_id,
                run_fingerprint=build_run_fingerprint(
                    job.artifact_sha256,
                    job.model_version,
                    job.rulepack_version,
                    job.config,
                    operation=job.operation,
                ),
                status="NEEDS_REVIEW",
                ecu_family=fp.ecu_family,
                hw_candidates=[{"value":value} for value in fp.hw_candidates],
                sw_candidates=[{"value":value} for value in fp.sw_candidates],
                supported=fp.supported,
                confidence=fp.confidence,
                evidence=[{"kind":"fingerprint","text":value} for value in fp.evidence],
                map_candidates=map_candidates,
                proposal={
                    "operation":"multi_service_proposal",
                    "release_ready":False,
                    "reasons":[f"{operation}:{reason}" for reason in reasons] or [f"{operation}:NOT_READY"],
                    "services":children,
                    "validation":{
                        "ready":False,
                        "errors":[f"{operation}:NOT_READY"],
                        "checksum":(result.proposal or {}).get("validation",{}).get("checksum",{}) if isinstance(result.proposal,dict) else {},
                    },
                },
            )
            return output,None,None
        working=mod_bytes
        last_checksum_algorithm=checksum_algorithm

    if final_result is None:
        raise ValueError("COMPOSITE_OPERATIONS_REQUIRED")

    fp=fingerprint_binary(artifact_bytes)
    final_validation={}
    if isinstance(final_result.proposal,dict):
        final_validation=final_result.proposal.get("validation") or {}
    output=AnalysisJobOutput(
        job_id=job.job_id,
        run_fingerprint=build_run_fingerprint(
            job.artifact_sha256,
            job.model_version,
            job.rulepack_version,
            job.config,
            operation=job.operation,
        ),
        status="READY",
        ecu_family=fp.ecu_family,
        hw_candidates=[{"value":value} for value in fp.hw_candidates],
        sw_candidates=[{"value":value} for value in fp.sw_candidates],
        supported=fp.supported,
        confidence=fp.confidence,
        evidence=[{"kind":"fingerprint","text":value} for value in fp.evidence],
        map_candidates=map_candidates,
        proposal={
            "operation":"multi_service_proposal",
            "release_ready":True,
            "reasons":[],
            "services":children,
            "validation":final_validation,
        },
    )
    return output,working,last_checksum_algorithm


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

        operation_label=OPERATION_LABEL_MAP.get(job.operation)
        if operation_label:
            effective_job=await _resolve_operation_job(
                effective_job,
                artifact_bytes,
                operation=job.operation,
                base_url=base_url,
                headers=headers,
                client=client,
            )

        effective_job=await _inject_checksum_profile(
            effective_job,
            artifact_bytes,
            base_url=base_url,
            headers=headers,
            client=client,
        )

        if job.operation=="multi_service_proposal":
            result,mod_bytes,checksum_algorithm=await _process_composite(
                effective_job,
                artifact_bytes,
                base_url=base_url,
                headers=headers,
                client=client,
            )
        else:
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
