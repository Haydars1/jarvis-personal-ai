import os

from fastapi.testclient import TestClient

import ecu_worker.server as server


def test_worker_health_endpoint():
    client = TestClient(server.app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_worker_job_endpoint_requires_compute_token(monkeypatch):
    monkeypatch.setenv("ECU_COMPUTE_TOKEN", "secret")
    client = TestClient(server.app)
    payload = {
        "job_id": "job-1",
        "artifact_sha256": "a" * 64,
        "artifact_uri": "r2://ecu-artifacts/originals/" + "a" * 64,
        "config": {"callback_base_url": "https://jarvis.example"},
    }
    response = client.post("/jobs", json=payload)
    assert response.status_code == 401
