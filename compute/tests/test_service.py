import asyncio

from ecu_worker.contracts import AnalysisJobInput
from ecu_worker.service import process_dispatched_job


class FakeResponse:
    def __init__(self, status_code=200, content=b"", json_data=None):
        self.status_code = status_code
        self.content = content
        self._json = json_data or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._json


class FakeClient:
    def __init__(self, artifact: bytes):
        self.artifact = artifact
        self.calls = []

    async def get(self, url, headers=None):
        self.calls.append(("GET", url, headers))
        return FakeResponse(200, self.artifact)

    async def post(self, url, headers=None, json=None):
        self.calls.append(("POST", url, headers, json))
        return FakeResponse(200, json_data={"ok": True})


def test_worker_pulls_artifact_runs_analysis_and_posts_result():
    marker = b"BOSCH EDC17C46 HW:0281012345 SW:1037512345\x00"
    table = b"".join((100 + r * 20 + c * 3).to_bytes(2, "big") for r in range(8) for c in range(8))
    client = FakeClient(marker + b"\x00" * 32 + table)
    job = AnalysisJobInput(
        job_id="job-1",
        artifact_sha256="a" * 64,
        artifact_uri="r2://ecu-artifacts/originals/" + "a" * 64,
        config={"callback_base_url": "https://jarvis.example"},
    )

    result = asyncio.run(process_dispatched_job(job, "secret", client=client))

    assert result.ecu_family == "EDC17C46"
    assert client.calls[0][0] == "GET"
    assert client.calls[0][1].endswith("/api/ecu/internal/artifacts/" + "a" * 64)
    assert client.calls[-1][0] == "POST"
    assert client.calls[-1][1].endswith("/api/ecu/internal/jobs/job-1/result")
    assert client.calls[-1][3]["status"] == "NEEDS_REVIEW"
