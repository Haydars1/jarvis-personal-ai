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
    assert client.calls[0][0] == "POST"
    assert client.calls[0][1].endswith("/api/ecu/internal/jobs/job-1/state")
    assert client.calls[0][3]["state"] == "RUNNING"
    assert client.calls[1][0] == "GET"
    assert client.calls[1][1].endswith("/api/ecu/internal/artifacts/" + "a" * 64)
    assert client.calls[-1][0] == "POST"
    assert client.calls[-1][1].endswith("/api/ecu/internal/jobs/job-1/result")
    assert client.calls[-1][3]["status"] == "NEEDS_REVIEW"


class ModelAwareClient(FakeClient):
    async def get(self, url, headers=None):
        self.calls.append(("GET", url, headers))
        if "/internal/models/" in url:
            return FakeResponse(200, b'{"version":1,"unknown_distance":3,"min_label_examples":2,"labels":{}}')
        return FakeResponse(200, self.artifact)


def test_analysis_worker_fetches_production_model_before_analysis():
    marker = b"BOSCH EDC17C46\x00"
    table = b"".join((100 + r * 20 + c * 3).to_bytes(2, "big") for r in range(8) for c in range(8))
    client = ModelAwareClient(marker + b"\x00" * 32 + table)
    job = AnalysisJobInput(
        job_id="job-model",
        artifact_sha256="c" * 64,
        artifact_uri="r2://ecu-artifacts/originals/" + "c" * 64,
        model_version="model-abc123",
        config={"callback_base_url": "https://jarvis.example"},
    )

    result = asyncio.run(process_dispatched_job(job, "secret", client=client))

    model_calls = [call for call in client.calls if call[0] == "GET" and "/internal/models/" in call[1]]
    assert len(model_calls) == 1
    assert model_calls[0][1].endswith("/api/ecu/internal/models/model-abc123")
    assert result.ecu_family == "EDC17C46"


class BrokenArtifactClient(FakeClient):
    async def get(self, url, headers=None):
        self.calls.append(("GET", url, headers))
        return FakeResponse(500, b"")


def test_analysis_worker_reports_failed_result_when_artifact_fetch_breaks():
    client = BrokenArtifactClient(b"")
    job = AnalysisJobInput(
        job_id="job-fail",
        artifact_sha256="f" * 64,
        artifact_uri="r2://ecu-artifacts/originals/" + "f" * 64,
        config={"callback_base_url": "https://jarvis.example"},
    )

    try:
        asyncio.run(process_dispatched_job(job, "secret", client=client))
    except RuntimeError:
        pass

    failed_callbacks = [
        call for call in client.calls
        if call[0] == "POST" and call[1].endswith("/api/ecu/internal/jobs/job-fail/result")
    ]
    assert len(failed_callbacks) == 1
    assert failed_callbacks[0][3]["status"] == "FAILED"


def test_worker_fetches_promoted_semantic_model_before_analysis():
    from ecu_worker.training.dataset import TrainingExample
    from ecu_worker.training.semantic_model import dump_semantic_model, fit_semantic_model

    def ex(label, span):
        return TrainingExample(
            ecu_family="EDC17C46", hw="HW", sw="SW",
            artifact_sha256=("c" if label == "torque_limiter" else "d") * 64,
            map_offset=100, semantic_label=label, source_type="verified_reference",
            source_confidence=1.0, human_verified=True,
            map_features={"rows": 8, "cols": 8, "span": span, "unique_ratio": 1.0, "smoothness": .8, "score": .95},
        )

    model_json = dump_semantic_model(fit_semantic_model([
        ex("torque_limiter", 180), ex("torque_limiter", 190),
        ex("boost_target", 1200), ex("boost_target", 1220),
    ]))

    marker = b"BOSCH EDC17C46\x00"
    table = b"".join((100 + r * 20 + c * 3).to_bytes(2, "big") for r in range(8) for c in range(8))

    class ModelClient(FakeClient):
        async def get(self, url, headers=None):
            self.calls.append(("GET", url, headers))
            if "/api/ecu/internal/models/" in url:
                return FakeResponse(200, model_json.encode("utf-8"))
            return FakeResponse(200, marker + b"\x00" * 32 + table)

    client = ModelClient(b"")
    job = AnalysisJobInput(
        job_id="job-model",
        artifact_sha256="e" * 64,
        artifact_uri="r2://ecu-artifacts/originals/" + "e" * 64,
        model_version="model-abc123",
        config={"callback_base_url": "https://jarvis.example"},
    )

    result = asyncio.run(process_dispatched_job(job, "secret", client=client))

    urls = [call[1] for call in client.calls if call[0] == "GET"]
    assert any(url.endswith("/api/ecu/internal/models/model-abc123") for url in urls)
    assert result.map_candidates
    assert "semantic_label" in result.map_candidates[0]


class RulepackAwareClient(FakeClient):
    async def get(self, url, headers=None):
        self.calls.append(("GET", url, headers))
        if "/api/ecu/internal/rulepack-candidates?" in url:
            return FakeResponse(200, json_data={
                "candidates":[{
                    "version":"rules-verified-1",
                    "matchTier":"EXACT_SW",
                    "portable":False,
                    "rules":{"__patches":[{
                        "offset":0,
                        "beforeHex":"42",
                        "afterHex":"43",
                        "contextBeforeHex":"",
                        "contextAfterHex":"4f534348",
                        "evidencePairs":5,
                    }]}
                }]
            })
        if "/api/ecu/internal/checksum-profile?" in url:
            return FakeResponse(404, json_data={})
        return FakeResponse(200, self.artifact)


def test_service_job_fetches_matching_rulepack_after_fingerprint():
    marker=b"BOSCH EDC17C46 HW:0281012345 SW:1037512345\x00"
    client=RulepackAwareClient(marker+b"\x00"*64)
    job=AnalysisJobInput(
        job_id="job-rulepack",
        artifact_sha256="a"*64,
        artifact_uri="r2://ecu-artifacts/originals/"+"a"*64,
        operation="egr_off_proposal",
        config={"callback_base_url":"https://jarvis.example","rulepack_verified":False},
    )

    result=asyncio.run(process_dispatched_job(job,"secret",client=client))

    urls=[call[1] for call in client.calls if call[0]=="GET"]
    assert any("/api/ecu/internal/rulepack-candidates?" in url for url in urls)
    assert result.ecu_family=="EDC17C46"
    assert result.proposal is not None
    assert result.proposal["operation_label"]=="egr_off"
