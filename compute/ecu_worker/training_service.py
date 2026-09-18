from __future__ import annotations

from dataclasses import asdict
from typing import Any

from .contracts import TrainingJobInput
from .training.dataset import TrainingExample
from .training.semantic_model import dump_semantic_model, fit_semantic_model, predict_semantic


def _example(raw: dict[str, Any]) -> TrainingExample:
    return TrainingExample(
        ecu_family=str(raw.get("ecu_family") or "UNKNOWN"),
        hw=str(raw.get("hw") or ""),
        sw=str(raw.get("sw") or ""),
        artifact_sha256=str(raw.get("artifact_sha256") or ""),
        map_offset=int(raw.get("map_offset") or 0),
        semantic_label=str(raw.get("semantic_label") or "UNKNOWN"),
        source_type=str(raw.get("source_type") or ""),
        source_confidence=float(raw.get("source_confidence") or 0.0),
        human_verified=bool(raw.get("human_verified")),
        map_features={k: float(v) for k, v in (raw.get("map_features") or {}).items()},
    )


def _metrics(model, rows: list[TrainingExample]) -> dict[str, float]:
    if not rows:
        return {
            "accuracy": 0.0,
            "macro_f1": 0.0,
            "unknown_precision": 1.0,
            "calibration_error": 1.0,
        }

    labels = sorted({row.semantic_label for row in rows if row.semantic_label != "UNKNOWN"})
    correct = 0
    confidences: list[float] = []
    correctness: list[float] = []
    per_label: dict[str, dict[str, int]] = {
        label: {"tp": 0, "fp": 0, "fn": 0} for label in labels
    }
    unknown_tp = 0
    unknown_fp = 0

    for row in rows:
        prediction = predict_semantic(model, row.map_features)
        expected = row.semantic_label
        actual = prediction.label
        if actual == expected:
            correct += 1
        confidences.append(float(prediction.confidence))
        correctness.append(1.0 if actual == expected else 0.0)

        for label in labels:
            if actual == label and expected == label:
                per_label[label]["tp"] += 1
            elif actual == label and expected != label:
                per_label[label]["fp"] += 1
            elif actual != label and expected == label:
                per_label[label]["fn"] += 1

        if actual == "UNKNOWN" and expected == "UNKNOWN":
            unknown_tp += 1
        elif actual == "UNKNOWN" and expected != "UNKNOWN":
            unknown_fp += 1

    f1s: list[float] = []
    for label in labels:
        stats = per_label[label]
        tp, fp, fn = stats["tp"], stats["fp"], stats["fn"]
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1s.append(2 * precision * recall / (precision + recall) if (precision + recall) else 0.0)

    calibration_error = sum(abs(c - y) for c, y in zip(confidences, correctness)) / len(rows)
    unknown_precision = unknown_tp / (unknown_tp + unknown_fp) if (unknown_tp + unknown_fp) else 1.0
    return {
        "accuracy": correct / len(rows),
        "macro_f1": sum(f1s) / len(f1s) if f1s else 0.0,
        "unknown_precision": unknown_precision,
        "calibration_error": calibration_error,
    }


async def process_training_job(
    job: TrainingJobInput,
    compute_token: str,
    *,
    client: Any,
) -> dict[str, Any]:
    base_url = str(job.config.get("callback_base_url") or "").rstrip("/")
    if not base_url:
        raise ValueError("callback_base_url is required")
    headers = {"authorization": f"Bearer {compute_token}"}

    dataset_url = f"{base_url}/api/ecu/internal/datasets/{job.dataset_digest}"
    dataset_response = await client.get(dataset_url, headers=headers)
    dataset_response.raise_for_status()
    snapshot = dataset_response.json()

    if str(snapshot.get("digest") or "") != job.dataset_digest:
        raise ValueError("DATASET_DIGEST_MISMATCH")
    if str(snapshot.get("version") or "") != job.dataset_version:
        raise ValueError("DATASET_VERSION_MISMATCH")

    examples = [_example(raw) for raw in (snapshot.get("examples") or [])]
    split_payload = snapshot.get("splits") or {}
    train_rows = [_example(raw) for raw in (split_payload.get("train") or [])]
    test_rows = [_example(raw) for raw in (split_payload.get("test") or [])]
    validation_rows = [_example(raw) for raw in (split_payload.get("validation") or [])]
    if not train_rows:
        train_rows = [row for row in examples if row.human_verified]

    model = fit_semantic_model(train_rows)
    model_json = dump_semantic_model(model)

    evaluation_rows = test_rows or validation_rows
    metrics = _metrics(model, evaluation_rows)
    metrics["training_count"] = len(train_rows)
    metrics["evaluation_count"] = len(evaluation_rows)
    metrics["label_count"] = len(model.labels)
    minimum_eval = max(4, len(model.labels) * 2)
    status = (
        "CANDIDATE"
        if model.labels and len(evaluation_rows) >= minimum_eval
        else "NEEDS_MORE_DATA"
    )

    result = {
        "status": status,
        "dataset_version": job.dataset_version,
        "dataset_digest": job.dataset_digest,
        "production_model_version": job.production_model_version,
        "model_json": model_json,
        "label_count": len(model.labels),
        "example_count": len(examples),
        "metrics": metrics,
        "paid_api_used": False,
    }
    callback_url = f"{base_url}/api/ecu/internal/training/{job.job_id}/result"
    callback_response = await client.post(
        callback_url,
        headers={**headers, "content-type": "application/json"},
        json=result,
    )
    callback_response.raise_for_status()
    return result
