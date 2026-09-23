import asyncio

from ecu_worker.contracts import TrainingJobInput
from ecu_worker.training_service import process_training_job


class FakeResponse:
    def __init__(self, status_code=200, json_data=None):
        self.status_code = status_code
        self._json = json_data or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._json


class FakeClient:
    def __init__(self, dataset):
        self.dataset = dataset
        self.calls = []

    async def get(self, url, headers=None):
        self.calls.append(("GET", url, headers))
        return FakeResponse(200, self.dataset)

    async def post(self, url, headers=None, json=None):
        self.calls.append(("POST", url, headers, json))
        return FakeResponse(200, {"ok": True})


def test_training_job_fetches_verified_snapshot_builds_candidate_and_callbacks():
    examples = []
    for i, span in enumerate((400, 420, 410, 430)):
        examples.append({
            "ecu_family": "EDC17C46",
            "hw": "HW-A",
            "sw": f"SW-T-{i}",
            "artifact_sha256": ("a" * 63) + str(i),
            "map_offset": 100 + i,
            "semantic_label": "torque_limiter",
            "source_type": "human_map_review",
            "source_confidence": 1.0,
            "human_verified": True,
            "map_features": {"rows": 16, "cols": 16, "span": span, "unique_ratio": .8, "smoothness": .9, "score": .95},
        })
    for i, span in enumerate((1200, 1220, 1210, 1240)):
        examples.append({
            "ecu_family": "EDC17C46",
            "hw": "HW-A",
            "sw": f"SW-B-{i}",
            "artifact_sha256": ("b" * 63) + str(i),
            "map_offset": 200 + i,
            "semantic_label": "boost_target",
            "source_type": "human_map_review",
            "source_confidence": 1.0,
            "human_verified": True,
            "map_features": {"rows": 12, "cols": 12, "span": span, "unique_ratio": .72, "smoothness": .77, "score": .91},
        })
    dataset = {"version": "dataset-8-1", "digest": "d" * 64, "examples": examples}
    client = FakeClient(dataset)
    job = TrainingJobInput(
        job_id="training-1",
        dataset_version="dataset-8-1",
        dataset_digest="d" * 64,
        production_model_version="baseline",
        config={"callback_base_url": "https://jarvis.example"},
    )

    result = asyncio.run(process_training_job(job, "secret", client=client))

    assert result["status"] in {"CANDIDATE", "NEEDS_MORE_DATA"}
    assert client.calls[0][0] == "GET"
    assert client.calls[0][1].endswith("/api/ecu/internal/datasets/" + "d" * 64)
    assert client.calls[-1][0] == "POST"
    assert client.calls[-1][1].endswith("/api/ecu/internal/training/training-1/result")
    assert "model_json" in client.calls[-1][3]
