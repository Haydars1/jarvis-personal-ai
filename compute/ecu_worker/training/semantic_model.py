from __future__ import annotations

import json
from dataclasses import dataclass, field
from math import exp, sqrt
from statistics import mean

from .dataset import TrainingExample

FEATURES = ("rows", "cols", "span", "unique_ratio", "smoothness", "score")


@dataclass(frozen=True)
class SemanticLabelStats:
    centroid: dict[str, float]
    scale: dict[str, float]
    count: int


@dataclass(frozen=True)
class SemanticModel:
    labels: dict[str, SemanticLabelStats] = field(default_factory=dict)
    unknown_distance: float = 3.0
    min_label_examples: int = 2


@dataclass(frozen=True)
class SemanticPrediction:
    label: str
    confidence: float
    distance: float | None
    needs_review: bool


def _value(features: dict[str, float], name: str) -> float:
    return float(features.get(name, 0.0))


def _label_stats(rows: list[TrainingExample]) -> SemanticLabelStats:
    centroid = {name: mean(_value(row.map_features, name) for row in rows) for name in FEATURES}
    scale: dict[str, float] = {}
    for name in FEATURES:
        values = [_value(row.map_features, name) for row in rows]
        center = centroid[name]
        variance = mean((value - center) ** 2 for value in values) if values else 0.0
        # A nonzero floor avoids exploding distance when two verified references
        # happen to have identical dimensions/features.
        floor = 1.0 if name in {"rows", "cols", "span"} else 0.02
        scale[name] = max(sqrt(variance), floor)
    return SemanticLabelStats(centroid=centroid, scale=scale, count=len(rows))


def fit_semantic_model(
    rows: list[TrainingExample],
    *,
    unknown_distance: float = 3.0,
    min_label_examples: int = 2,
) -> SemanticModel:
    grouped: dict[str, list[TrainingExample]] = {}
    for row in rows:
        if not row.human_verified or not row.map_features or row.semantic_label == "UNKNOWN":
            continue
        grouped.setdefault(row.semantic_label, []).append(row)

    labels = {
        label: _label_stats(items)
        for label, items in sorted(grouped.items())
        if len(items) >= min_label_examples
    }
    return SemanticModel(
        labels=labels,
        unknown_distance=float(unknown_distance),
        min_label_examples=int(min_label_examples),
    )


def _distance(stats: SemanticLabelStats, features: dict[str, float]) -> float:
    total = 0.0
    for name in FEATURES:
        delta = (_value(features, name) - stats.centroid[name]) / stats.scale[name]
        total += delta * delta
    return sqrt(total / len(FEATURES))


def predict_semantic(model: SemanticModel, features: dict[str, float]) -> SemanticPrediction:
    if not model.labels:
        return SemanticPrediction(label="UNKNOWN", confidence=0.0, distance=None, needs_review=True)

    ranked = sorted(
        ((_distance(stats, features), label) for label, stats in model.labels.items()),
        key=lambda item: (item[0], item[1]),
    )
    best_distance, best_label = ranked[0]
    if best_distance > model.unknown_distance:
        return SemanticPrediction(
            label="UNKNOWN",
            confidence=max(0.0, min(0.49, exp(-best_distance))),
            distance=best_distance,
            needs_review=True,
        )

    second_distance = ranked[1][0] if len(ranked) > 1 else model.unknown_distance
    closeness = exp(-best_distance)
    separation = max(0.0, min(1.0, (second_distance - best_distance) / max(second_distance, 1e-9)))
    confidence = max(0.0, min(1.0, 0.65 * closeness + 0.35 * separation))
    needs_review = confidence < 0.70
    return SemanticPrediction(
        label=best_label if not needs_review else "UNKNOWN",
        confidence=confidence,
        distance=best_distance,
        needs_review=needs_review,
    )


def dump_semantic_model(model: SemanticModel) -> str:
    payload = {
        "version": 1,
        "unknown_distance": model.unknown_distance,
        "min_label_examples": model.min_label_examples,
        "labels": {
            label: {
                "centroid": stats.centroid,
                "scale": stats.scale,
                "count": stats.count,
            }
            for label, stats in sorted(model.labels.items())
        },
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def load_semantic_model(payload: str | bytes) -> SemanticModel:
    if isinstance(payload, bytes):
        payload = payload.decode("utf-8")
    raw = json.loads(payload)
    if int(raw.get("version", 0)) != 1:
        raise ValueError("UNSUPPORTED_SEMANTIC_MODEL_VERSION")
    labels = {
        label: SemanticLabelStats(
            centroid={name: float(values["centroid"][name]) for name in FEATURES},
            scale={name: float(values["scale"][name]) for name in FEATURES},
            count=int(values["count"]),
        )
        for label, values in sorted((raw.get("labels") or {}).items())
    }
    return SemanticModel(
        labels=labels,
        unknown_distance=float(raw.get("unknown_distance", 3.0)),
        min_label_examples=int(raw.get("min_label_examples", 2)),
    )
