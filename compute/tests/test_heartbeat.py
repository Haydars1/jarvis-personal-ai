import asyncio

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
