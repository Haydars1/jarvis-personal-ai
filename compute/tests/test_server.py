import os

from fastapi.testclient import TestClient

import ecu_worker.server as server


def test_worker_health_endpoint():
    client = TestClient(server.app)
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["heartbeat"] == {
        "enabled": False,
        "running": False,
        "healthy": None,
        "last_success_at": None,
        "last_error_at": None,
    }
    assert "token" not in str(body).lower()
    assert "public_url" not in str(body).lower()


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


def test_compute_authorization_fails_closed_and_matches_exact_bearer(monkeypatch):
    monkeypatch.delenv("ECU_COMPUTE_TOKEN", raising=False)
    assert server._authorized(None) is False
    assert server._authorized("Bearer anything") is False

    monkeypatch.setenv("ECU_COMPUTE_TOKEN", "secret")
    assert server._authorized(None) is False
    assert server._authorized("secret") is False
    assert server._authorized("Bearer secret-extra") is False
    assert server._authorized("Bearer secret") is True


def test_local_heartbeat_is_opt_in(monkeypatch):
    monkeypatch.delenv("ECU_LOCAL_HEARTBEAT_ENABLED", raising=False)
    assert server._local_heartbeat_enabled() is False
    monkeypatch.setenv("ECU_LOCAL_HEARTBEAT_ENABLED", "true")
    assert server._local_heartbeat_enabled() is True
    monkeypatch.setenv("ECU_LOCAL_HEARTBEAT_ENABLED", "0")
    assert server._local_heartbeat_enabled() is False
