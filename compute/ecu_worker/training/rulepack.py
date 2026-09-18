from __future__ import annotations

from dataclasses import dataclass, field
from statistics import median


@dataclass(frozen=True)
class RulepackCandidate:
    state: str = "EVIDENCE_CANDIDATE"
    verified: bool = False
    ready_for_benchmark: bool = False
    rules: dict[str, dict] = field(default_factory=dict)


def build_rulepack_candidate(
    rows: list[dict],
    *,
    operation_label: str = "stage1",
    min_pairs_per_label: int = 5,
) -> RulepackCandidate:
    grouped: dict[str, dict[str, float]] = {}

    for row in rows:
        if not bool(row.get("human_verified")):
            continue
        if str(row.get("operation_label") or "") != operation_label:
            continue
        label = str(row.get("semantic_label") or "UNKNOWN")
        if label == "UNKNOWN":
            continue
        pair_id = str(row.get("pair_id") or "")
        if not pair_id:
            continue
        stats = row.get("delta_stats") or {}
        try:
            value = float(
                stats.get("p95AbsPercent")
                if stats.get("p95AbsPercent") is not None
                else stats.get("p95_abs_percent")
            )
        except (TypeError, ValueError):
            continue
        if value <= 0:
            continue
        grouped.setdefault(label, {})[pair_id] = value

    rules: dict[str, dict] = {}
    for label, by_pair in sorted(grouped.items()):
        values = sorted(by_pair.values())
        if len(values) < min_pairs_per_label:
            continue
        rules[label] = {
            "evidence_pairs": len(values),
            "observed_envelope_percent": float(median(values)),
            "min_observed_percent": float(min(values)),
            "max_observed_percent": float(max(values)),
        }

    return RulepackCandidate(
        state="EVIDENCE_CANDIDATE",
        verified=False,
        ready_for_benchmark=bool(rules),
        rules=rules,
    )
