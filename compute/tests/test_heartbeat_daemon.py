import asyncio

import pytest

from ecu_worker.heartbeat_daemon import heartbeat_config_from_env, run_heartbeat_loop


class FakeResponse:
    def raise_for_status(self): pass
    def json(self): return {"worker": {"id": "laptop-1", "kind": "local"}}


class FakeClient:
    def __init__(self): self.calls = []
    async def post(self, url, headers=None, json=None):
        self.calls.append((url, headers, json))
        return FakeResponse()


class FlakyClient(FakeClient):
    def __init__(self):
        super().__init__()
        self.failures_left = 1

    async def post(self, url, headers=None, json=None):
        self.calls.append((url, headers, json))
        if self.failures_left:
            self.failures_left -= 1
            raise RuntimeError("temporary network failure")
        return FakeResponse()


def test_config_requires_public_jobs_url():
    with pytest.raises(ValueError, match="ECU_WORKER_PUBLIC_URL_REQUIRED"):
        heartbeat_config_from_env({
            "JARVIS_BASE_URL": "https://jarvis.example",
            "ECU_COMPUTE_TOKEN": "secret",
            "ECU_WORKER_ID": "laptop-1",
        })


def test_loop_sends_immediately_then_stops_cleanly():
    client = FakeClient()
    sleeps = []
    async def stop_after_first(delay):
        sleeps.append(delay)
        raise asyncio.CancelledError()

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(run_heartbeat_loop(
            jarvis_base_url="https://jarvis.example",
            worker_public_url="https://worker.example/jobs",
            compute_token="secret",
            worker_id="laptop-1",
            client=client,
            interval_seconds=45,
            sleep=stop_after_first,
        ))

    assert len(client.calls) == 1
    assert sleeps == [45]
    assert client.calls[0][2]["ttlSeconds"] >= 90


def test_loop_retries_transient_failure_without_exiting():
    client = FlakyClient()
    sleeps = []

    async def capture_sleep(delay):
        sleeps.append(delay)
        if len(sleeps) == 2:
            raise asyncio.CancelledError()

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(run_heartbeat_loop(
            jarvis_base_url="https://jarvis.example",
            worker_public_url="https://worker.example/jobs",
            compute_token="secret",
            worker_id="laptop-1",
            client=client,
            interval_seconds=45,
            retry_initial_seconds=5,
            retry_max_seconds=20,
            sleep=capture_sleep,
        ))

    assert len(client.calls) == 2
    assert sleeps == [5, 45]
