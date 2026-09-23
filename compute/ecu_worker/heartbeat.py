from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit


def _validated_https_url(value: str, *, require_jobs_path: bool, error: str) -> str:
    candidate=value.strip().rstrip("/") if not require_jobs_path else value.strip()
    try:
        parsed=urlsplit(candidate)
    except ValueError as exc:
        raise ValueError(error) from exc
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError(error)
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError(error)
    if require_jobs_path and not parsed.path.endswith("/jobs"):
        raise ValueError(error)
    return candidate


async def send_local_heartbeat(
    *,
    jarvis_base_url: str,
    worker_public_url: str,
    compute_token: str,
    worker_id: str,
    client: Any,
    ttl_seconds: int = 90,
) -> dict:
    base=_validated_https_url(
        jarvis_base_url,
        require_jobs_path=False,
        error="JARVIS_HTTPS_REQUIRED",
    )
    endpoint=_validated_https_url(
        worker_public_url,
        require_jobs_path=True,
        error="WORKER_PUBLIC_HTTPS_JOBS_URL_REQUIRED",
    )
    if not compute_token:
        raise ValueError("ECU_COMPUTE_TOKEN_REQUIRED")
    if not worker_id:
        raise ValueError("WORKER_ID_REQUIRED")

    response=await client.post(
        f"{base}/api/ecu/internal/workers/heartbeat",
        headers={
            "authorization":f"Bearer {compute_token}",
            "content-type":"application/json",
        },
        json={
            "workerId":worker_id,
            "kind":"local",
            "endpoint":endpoint,
            "ttlSeconds":max(30,min(300,int(ttl_seconds))),
            "capabilities":["analyze","diff_pair","train"],
        },
    )
    response.raise_for_status()
    return response.json()
