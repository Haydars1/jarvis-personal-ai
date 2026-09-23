import asyncio

import pytest

from ecu_worker.heartbeat import send_local_heartbeat


class FakeResponse:
    status_code=200
    def raise_for_status(self): pass
    def json(self): return {"worker":{"id":"laptop-1","kind":"local"}}


class FakeClient:
    def __init__(self): self.calls=[]
    async def post(self,url,headers=None,json=None):
        self.calls.append((url,headers,json))
        return FakeResponse()


def test_local_heartbeat_posts_public_jobs_endpoint_and_capabilities():
    client=FakeClient()
    result=asyncio.run(send_local_heartbeat(
        jarvis_base_url="https://jarvis.example",
        worker_public_url="https://my-tunnel.example/jobs",
        compute_token="secret",
        worker_id="laptop-1",
        client=client,
    ))
    assert result["worker"]["kind"]=="local"
    url,headers,payload=client.calls[0]
    assert url=="https://jarvis.example/api/ecu/internal/workers/heartbeat"
    assert headers["authorization"]=="Bearer secret"
    assert payload["endpoint"]=="https://my-tunnel.example/jobs"
    assert "analyze" in payload["capabilities"]
    assert "train" in payload["capabilities"]


@pytest.mark.parametrize("worker_url", [
    "https://user:pass@my-tunnel.example/jobs",
    "https://my-tunnel.example/jobs?next=https://127.0.0.1",
    "https://my-tunnel.example/jobs#fragment",
    "https://my-tunnel.example/not-jobs",
    "http://my-tunnel.example/jobs",
])
def test_local_heartbeat_rejects_ambiguous_or_insecure_worker_urls(worker_url):
    client=FakeClient()
    with pytest.raises(ValueError, match="WORKER_PUBLIC_HTTPS_JOBS_URL_REQUIRED"):
        asyncio.run(send_local_heartbeat(
            jarvis_base_url="https://jarvis.example",
            worker_public_url=worker_url,
            compute_token="secret",
            worker_id="laptop-1",
            client=client,
        ))
    assert client.calls == []


@pytest.mark.parametrize("jarvis_url", [
    "https://user:pass@jarvis.example",
    "https://jarvis.example?redirect=https://evil.example",
    "https://jarvis.example#fragment",
    "http://jarvis.example",
])
def test_local_heartbeat_rejects_ambiguous_or_insecure_jarvis_urls(jarvis_url):
    client=FakeClient()
    with pytest.raises(ValueError, match="JARVIS_HTTPS_REQUIRED"):
        asyncio.run(send_local_heartbeat(
            jarvis_base_url=jarvis_url,
            worker_public_url="https://my-tunnel.example/jobs",
            compute_token="secret",
            worker_id="laptop-1",
            client=client,
        ))
    assert client.calls == []
