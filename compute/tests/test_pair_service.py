import asyncio

from ecu_worker.contracts import PairJobInput
from ecu_worker.pair_service import process_pair_job


class FakeResponse:
    def __init__(self,status_code=200,content=b"",json_data=None):
        self.status_code=status_code
        self.content=content
        self._json=json_data or {}
    def raise_for_status(self):
        if self.status_code>=400:
            raise RuntimeError(f"HTTP {self.status_code}")
    def json(self):
        return self._json


class FakeClient:
    def __init__(self,ori,mod):
        self.ori=ori
        self.mod=mod
        self.calls=[]
    async def get(self,url,headers=None):
        self.calls.append(("GET",url,headers))
        if url.endswith("a"*64):
            return FakeResponse(200,self.ori)
        return FakeResponse(200,self.mod)
    async def post(self,url,headers=None,json=None):
        self.calls.append(("POST",url,headers,json))
        return FakeResponse(200,json_data={"ok":True})


def test_pair_job_fetches_ori_and_mod_and_posts_diff_report():
    ori=bytes([0,1,2,3,4,5])
    mod=bytes([0,1,9,10,4,5])
    client=FakeClient(ori,mod)
    job=PairJobInput(
        job_id="pair-1",
        ori_artifact_sha256="a"*64,
        mod_artifact_sha256="b"*64,
        ori_artifact_uri="r2://ecu-artifacts/originals/"+"a"*64,
        mod_artifact_uri="r2://ecu-artifacts/originals/"+"b"*64,
        operation_label="stage1",
        config={"callback_base_url":"https://jarvis.example"},
    )
    result=asyncio.run(process_pair_job(job,"secret",client=client))
    assert result["status"]=="COMPLETE"
    assert result["diff"]["changed_byte_count"]==2
    assert result["diff"]["ranges"][0]["start"]==2
    assert client.calls[-1][0]=="POST"
    assert client.calls[-1][1].endswith("/api/ecu/internal/pairs/pair-1/result")


class BrokenPairClient(FakeClient):
    async def get(self,url,headers=None):
        self.calls.append(("GET",url,headers))
        return FakeResponse(500,b"")


def test_pair_worker_reports_failed_callback_on_fetch_error():
    client=BrokenPairClient(b"",b"")
    job=PairJobInput(
        job_id="pair-fail",
        ori_artifact_sha256="a"*64,
        mod_artifact_sha256="b"*64,
        ori_artifact_uri="r2://ecu-artifacts/originals/"+"a"*64,
        mod_artifact_uri="r2://ecu-artifacts/originals/"+"b"*64,
        operation_label="stage1",
        config={"callback_base_url":"https://jarvis.example"},
    )
    try:
        asyncio.run(process_pair_job(job,"secret",client=client))
    except RuntimeError:
        pass
    callbacks=[call for call in client.calls if call[0]=="POST" and call[1].endswith("/api/ecu/internal/pairs/pair-fail/result")]
    assert len(callbacks)==1
    assert callbacks[0][3]["status"]=="FAILED"


class ContextPairClient(FakeClient):
    async def get(self,url,headers=None):
        self.calls.append(("GET",url,headers))
        if "/api/ecu/internal/map-context/" in url:
            return FakeResponse(200,json_data={"maps":[
                {"offset":2,"rows":1,"cols":2,"dataType":"u16","semanticLabel":"torque_limiter","confidence":0.97}
            ]})
        if url.endswith("a"*64):
            return FakeResponse(200,self.ori)
        return FakeResponse(200,self.mod)


def test_pair_worker_links_diff_ranges_to_existing_map_context():
    ori=bytes([0,1,2,3,4,5,6,7])
    mod=bytes([0,1,9,10,4,5,6,7])
    client=ContextPairClient(ori,mod)
    job=PairJobInput(
        job_id="pair-context",
        ori_artifact_sha256="a"*64,
        mod_artifact_sha256="b"*64,
        ori_artifact_uri="r2://ecu-artifacts/originals/"+"a"*64,
        mod_artifact_uri="r2://ecu-artifacts/originals/"+"b"*64,
        operation_label="stage1",
        config={"callback_base_url":"https://jarvis.example"},
    )
    result=asyncio.run(process_pair_job(job,"secret",client=client))
    linked=result["diff"]["linked_ranges"]
    assert linked[0]["map_hits"][0]["semantic_label"]=="torque_limiter"
    assert linked[0]["map_hits"][0]["overlap_bytes"]==2
