from __future__ import annotations

from typing import Any


async def send_local_heartbeat(
    *,
    jarvis_base_url: str,
    worker_public_url: str,
    compute_token: str,
    worker_id: str,
    client: Any,
    ttl_seconds: int = 90,
) -> dict:
    base=jarvis_base_url.rstrip("/")
    endpoint=worker_public_url.strip()
    if not base.startswith("https://"):
        raise ValueError("JARVIS_HTTPS_REQUIRED")
    if not endpoint.startswith("https://") or not endpoint.endswith("/jobs"):
        raise ValueError("WORKER_PUBLIC_HTTPS_JOBS_URL_REQUIRED")
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
