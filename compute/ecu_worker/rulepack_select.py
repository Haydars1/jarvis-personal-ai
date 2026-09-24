from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from typing import Any

from .mutation import apply_exact_patches


@dataclass(frozen=True)
class RulepackSelection:
    candidate: dict[str, Any] | None
    reason: str
    compatible_count: int = 0
    unique_outputs: int = 0


def _rules(candidate: dict[str, Any]) -> dict[str, Any]:
    value=candidate.get("rules")
    return value if isinstance(value,dict) else {}


def select_rulepack_for_binary(
    data: bytes,
    candidates: list[dict[str, Any]],
    *,
    operation_label: str,
) -> RulepackSelection:
    rows=[row for row in candidates if isinstance(row,dict)]
    if not rows:
        return RulepackSelection(None,"NO_RULEPACK_CANDIDATES")

    if operation_label=="stage1":
        for row in rows:
            if row.get("matchTier") in {"EXACT_SW","GENERIC_SCOPE"}:
                return RulepackSelection(row,"STAGE1_SCOPED_RULEPACK",1,1)
        return RulepackSelection(None,"STAGE1_EXACT_RULEPACK_REQUIRED")

    compatible: list[tuple[dict[str,Any],str]]=[]
    for row in rows:
        patches=_rules(row).get("__patches")
        if not isinstance(patches,list) or not patches:
            continue
        try:
            mutation=apply_exact_patches(data,patches)
        except ValueError:
            continue
        compatible.append((row,sha256(mutation.data).hexdigest()))

    if not compatible:
        return RulepackSelection(None,"NO_COMPATIBLE_RULEPACK")

    exact=[item for item in compatible if item[0].get("matchTier")=="EXACT_SW"]
    if exact:
        digests={digest for _row,digest in exact}
        if len(digests)>1:
            return RulepackSelection(None,"EXACT_RULEPACK_AMBIGUOUS",len(exact),len(digests))
        return RulepackSelection(exact[0][0],"EXACT_RULEPACK_MATCH",len(compatible),len({d for _r,d in compatible}))

    generic=[item for item in compatible if item[0].get("matchTier")=="GENERIC_SCOPE"]
    if generic:
        digests={digest for _row,digest in generic}
        if len(digests)>1:
            return RulepackSelection(None,"GENERIC_RULEPACK_AMBIGUOUS",len(generic),len(digests))
        return RulepackSelection(generic[0][0],"GENERIC_RULEPACK_MATCH",len(compatible),len({d for _r,d in compatible}))

    output_digests={digest for _row,digest in compatible}
    if len(output_digests)>1:
        return RulepackSelection(
            None,
            "PORTABLE_RULEPACK_AMBIGUOUS",
            len(compatible),
            len(output_digests),
        )

    return RulepackSelection(
        compatible[0][0],
        "PORTABLE_CONTEXT_MATCH",
        len(compatible),
        1,
    )
