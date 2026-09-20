from __future__ import annotations

import asyncio
import os
from collections.abc import Awaitable, Callable, Mapping

import httpx

from .heartbeat import send_local_heartbeat


def heartbeat_config_from_env(env: Mapping[str, str] | None = None) -> dict[str, object]:
    values = os.environ if env is None else env
    base_url = str(values.get("JARVIS_BASE_URL", "")).strip()
    public_url = str(values.get("ECU_WORKER_PUBLIC_URL", "")).strip()
    token = str(values.get("ECU_COMPUTE_TOKEN", "")).strip()
    worker_id = str(values.get("ECU_WORKER_ID", "")).strip()
    if not base_url:
        raise ValueError("JARVIS_BASE_URL_REQUIRED")
    if not public_url:
        raise ValueError("ECU_WORKER_PUBLIC_URL_REQUIRED")
    if not token:
        raise ValueError("ECU_COMPUTE_TOKEN_REQUIRED")
    if not worker_id:
        raise ValueError("ECU_WORKER_ID_REQUIRED")
    interval = max(15, min(120, int(values.get("ECU_HEARTBEAT_INTERVAL_SECONDS", "45"))))
    ttl = max(90, min(300, interval * 3))
    return {
        "jarvis_base_url": base_url,
        "worker_public_url": public_url,
        "compute_token": token,
        "worker_id": worker_id,
        "interval_seconds": interval,
        "ttl_seconds": ttl,
    }


async def run_heartbeat_loop(
    *,
    jarvis_base_url: str,
    worker_public_url: str,
    compute_token: str,
    worker_id: str,
    client: object,
    interval_seconds: int = 45,
    ttl_seconds: int | None = None,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
) -> None:
    interval = max(15, min(120, int(interval_seconds)))
    ttl = max(90, min(300, int(ttl_seconds or interval * 3)))
    while True:
        await send_local_heartbeat(
            jarvis_base_url=jarvis_base_url,
            worker_public_url=worker_public_url,
            compute_token=compute_token,
            worker_id=worker_id,
            client=client,
            ttl_seconds=ttl,
        )
        await sleep(interval)


async def _main() -> None:
    config = heartbeat_config_from_env()
    async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=10.0)) as client:
        await run_heartbeat_loop(client=client, **config)


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
