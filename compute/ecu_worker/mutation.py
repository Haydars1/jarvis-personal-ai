from __future__ import annotations

from dataclasses import dataclass, field

from .proposal import Stage1Proposal


@dataclass(frozen=True)
class MutationChange:
    semantic_label: str
    offset: int
    cells: int
    changed_cells: int
    target_delta_percent: float


@dataclass(frozen=True)
class MutationResult:
    data: bytes
    changes: list[MutationChange] = field(default_factory=list)
    allowed_ranges: list[tuple[int, int]] = field(default_factory=list)


def apply_stage1_mutation(ori: bytes, proposal: Stage1Proposal) -> MutationResult:
    if proposal.blocked:
        raise ValueError("STAGE1_PROPOSAL_BLOCKED")
    out=bytearray(ori)
    changes: list[MutationChange]=[]
    allowed: list[tuple[int,int]]=[]
    for item in proposal.items:
        rows=int(item.rows or 0)
        cols=int(item.cols or 0)
        count=rows*cols
        if count<=0 or item.data_type not in {"u16","s16"} or item.endian not in {"big","little"}:
            raise ValueError("STAGE1_MAP_FORMAT_UNSUPPORTED")
        start=int(item.offset)
        end=start+count*2
        if start<0 or end>len(out):
            raise ValueError("STAGE1_MAP_RANGE_INVALID")
        signed=item.data_type=="s16"
        low,high=(-32768,32767) if signed else (0,65535)
        changed=0
        ratio=1.0+float(item.target_delta_percent)/100.0
        for index in range(count):
            pos=start+index*2
            before=int.from_bytes(out[pos:pos+2],item.endian,signed=signed)
            if before==0:
                continue
            after=round(before*ratio)
            after=max(low,min(high,after))
            if after==before:
                continue
            out[pos:pos+2]=int(after).to_bytes(2,item.endian,signed=signed)
            changed+=1
        if changed:
            allowed.append((start,end))
            changes.append(MutationChange(item.semantic_label,start,count,changed,float(item.target_delta_percent)))
    if not changes:
        raise ValueError("STAGE1_NO_VERIFIED_CHANGES")
    return MutationResult(data=bytes(out),changes=changes,allowed_ranges=allowed)


def apply_exact_patches(
    ori: bytes,
    patches: list[dict],
    *,
    max_patches: int = 256,
    max_total_bytes: int = 16384,
    relocation_window: int = 2048,
) -> MutationResult:
    if not patches:
        raise ValueError("PATCH_RULEPACK_EMPTY")
    if len(patches) > max_patches:
        raise ValueError("PATCH_RULEPACK_TOO_LARGE")

    normalized: list[dict] = []
    total = 0
    for raw in patches:
        try:
            offset = int(raw.get("offset"))
            before = bytes.fromhex(str(raw.get("beforeHex") or raw.get("before_hex") or ""))
            after = bytes.fromhex(str(raw.get("afterHex") or raw.get("after_hex") or ""))
            context_before = bytes.fromhex(str(raw.get("contextBeforeHex") or raw.get("context_before_hex") or ""))
            context_after = bytes.fromhex(str(raw.get("contextAfterHex") or raw.get("context_after_hex") or ""))
        except (TypeError, ValueError):
            raise ValueError("PATCH_RULE_INVALID")
        if offset < 0 or not before or len(before) != len(after) or before == after:
            raise ValueError("PATCH_RULE_INVALID")
        end = offset + len(before)
        if end > len(ori):
            raise ValueError("PATCH_RANGE_INVALID")
        total += len(before)
        if total > max_total_bytes:
            raise ValueError("PATCH_RULEPACK_TOO_LARGE")
        normalized.append({
            "offset": offset,
            "before": before,
            "after": after,
            "context_before": context_before,
            "context_after": context_after,
        })

    normalized.sort(key=lambda item: item["offset"])
    previous_end = -1
    for item in normalized:
        if item["offset"] < previous_end:
            raise ValueError("PATCH_RULES_OVERLAP")
        previous_end = item["offset"] + len(item["before"])

    snapshot = bytes(ori)
    resolved: list[tuple[int, dict]] = []
    for item in normalized:
        expected = item["offset"]
        before = item["before"]
        end = expected + len(before)
        if snapshot[expected:end] == before:
            resolved.append((expected, item))
            continue

        ctx_before = item["context_before"]
        ctx_after = item["context_after"]
        if not ctx_before and not ctx_after:
            raise ValueError(f"PATCH_PRECONDITION_MISMATCH:{expected}")

        anchor = ctx_before + before + ctx_after
        start = max(0, expected - relocation_window - len(ctx_before))
        stop = min(len(snapshot), expected + relocation_window + len(before) + len(ctx_after))
        region = snapshot[start:stop]
        matches: list[int] = []
        pos = 0
        while True:
            found = region.find(anchor, pos)
            if found < 0:
                break
            matches.append(start + found + len(ctx_before))
            pos = found + 1
        if not matches:
            raise ValueError(f"PATCH_CONTEXT_NOT_FOUND:{expected}")
        if len(matches) != 1:
            raise ValueError(f"PATCH_CONTEXT_AMBIGUOUS:{expected}")
        resolved.append((matches[0], item))

    resolved.sort(key=lambda entry: entry[0])
    previous_end = -1
    for actual, item in resolved:
        if actual < previous_end:
            raise ValueError("PATCH_RESOLVED_OVERLAP")
        previous_end = actual + len(item["before"])

    out = bytearray(snapshot)
    changes: list[MutationChange] = []
    allowed: list[tuple[int, int]] = []
    for actual, item in resolved:
        before = item["before"]
        after = item["after"]
        end = actual + len(before)
        if snapshot[actual:end] != before:
            raise ValueError(f"PATCH_PRECONDITION_MISMATCH:{item['offset']}")
        changed = sum(1 for left, right in zip(before, after) if left != right)
        if not changed:
            continue
        out[actual:end] = after
        allowed.append((actual, end))
        changes.append(MutationChange("EXACT_PATCH", actual, len(before), changed, 0.0))

    if not changes:
        raise ValueError("PATCH_NO_CHANGES")
    return MutationResult(data=bytes(out), changes=changes, allowed_ranges=allowed)

