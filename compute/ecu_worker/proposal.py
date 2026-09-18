from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class CalibrationRule:
    label: str
    max_delta_percent: float


@dataclass(frozen=True)
class ProposalItem:
    semantic_label: str
    offset: int
    rows: int | None
    cols: int | None
    max_delta_percent: float
    confidence: float


@dataclass(frozen=True)
class Stage1Proposal:
    items: list[ProposalItem] = field(default_factory=list)
    blocked: bool = False
    reasons: list[str] = field(default_factory=list)
    unknown_maps: int = 0
    requires_checksum: bool = True


def propose_stage1(
    maps: list[dict],
    rules: dict[str, CalibrationRule],
    *,
    min_confidence: float = 0.90,
    required_labels: set[str] | None = None,
) -> Stage1Proposal:
    items: list[ProposalItem] = []
    unknown_maps = 0

    for candidate in maps:
        label = str(candidate.get("semantic_label") or "UNKNOWN")
        confidence = float(candidate.get("semantic_confidence") or candidate.get("confidence") or 0.0)
        rule = rules.get(label)
        if label == "UNKNOWN" or confidence < min_confidence or rule is None:
            unknown_maps += 1
            continue
        items.append(
            ProposalItem(
                semantic_label=label,
                offset=int(candidate.get("offset") or 0),
                rows=None if candidate.get("rows") is None else int(candidate.get("rows")),
                cols=None if candidate.get("cols") is None else int(candidate.get("cols")),
                max_delta_percent=max(0.0, float(rule.max_delta_percent)),
                confidence=confidence,
            )
        )

    reasons: list[str] = []
    if required_labels:
        present = {item.semantic_label for item in items}
        for label in sorted(required_labels - present):
            reasons.append(f"MISSING_REQUIRED_MAP:{label}")

    return Stage1Proposal(
        items=items,
        blocked=bool(reasons),
        reasons=reasons,
        unknown_maps=unknown_maps,
        requires_checksum=True,
    )


def stage1_proposal_from_config(
    maps: list[dict],
    config: dict,
    *,
    min_confidence: float = 0.90,
) -> Stage1Proposal:
    if not bool(config.get("rulepack_verified")):
        return Stage1Proposal(
            items=[],
            blocked=True,
            reasons=["RULEPACK_UNVERIFIED"],
            unknown_maps=len(maps),
            requires_checksum=True,
        )

    raw_rules=config.get("rulepack") or {}
    rules: dict[str, CalibrationRule] = {}
    for label, payload in raw_rules.items():
        try:
            delta=float((payload or {}).get("max_delta_percent"))
        except (TypeError,ValueError):
            continue
        if delta <= 0:
            continue
        rules[str(label)] = CalibrationRule(label=str(label), max_delta_percent=delta)

    required_labels={str(x) for x in (config.get("required_labels") or []) if str(x)}
    return propose_stage1(
        maps,
        rules,
        min_confidence=min_confidence,
        required_labels=required_labels or None,
    )
