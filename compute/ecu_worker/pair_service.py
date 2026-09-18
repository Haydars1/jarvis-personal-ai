from __future__ import annotations

from dataclasses import asdict
from typing import Any

from .contracts import PairJobInput
from .diff import diff_bytes


async def process_pair_job(
    job: PairJobInput,
    compute_token: str,
    *,
    client: Any,
) -> dict[str, Any]:
    base_url=str(job.config.get("callback_base_url") or "").rstrip("/")
    if not base_url:
        raise ValueError("callback_base_url is required")
    headers={"authorization":f"Bearer {compute_token}"}

    callback_url=f"{base_url}/api/ecu/internal/pairs/{job.job_id}/result"
    try:
        ori_url=f"{base_url}/api/ecu/internal/artifacts/{job.ori_artifact_sha256}"
        mod_url=f"{base_url}/api/ecu/internal/artifacts/{job.mod_artifact_sha256}"
        ori_response=await client.get(ori_url,headers=headers)
        ori_response.raise_for_status()
        mod_response=await client.get(mod_url,headers=headers)
        mod_response.raise_for_status()

        report=diff_bytes(bytes(ori_response.content),bytes(mod_response.content))
        payload={
            "status":"COMPLETE",
            "operation_label":job.operation_label,
            "diff":{
                "original_size":report.original_size,
                "modified_size":report.modified_size,
                "changed_byte_count":report.changed_byte_count,
                "ranges":[asdict(item) for item in report.ranges],
                "digest":report.digest,
            },
            "paid_api_used":False,
        }
        callback_response=await client.post(
            callback_url,
            headers={**headers,"content-type":"application/json"},
            json=payload,
        )
        callback_response.raise_for_status()
        return payload
    except Exception as exc:
        failed={
            "status":"FAILED",
            "operation_label":job.operation_label,
            "error":f"{type(exc).__name__}: {exc}"[:500],
            "paid_api_used":False,
        }
        try:
            await client.post(
                callback_url,
                headers={**headers,"content-type":"application/json"},
                json=failed,
            )
        finally:
            raise
