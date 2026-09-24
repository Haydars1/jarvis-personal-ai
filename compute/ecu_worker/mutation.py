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
) -> MutationResult:
    if not patches:
        raise ValueError("PATCH_RULEPACK_EMPTY")
    if len(patches) > max_patches:
        raise ValueError("PATCH_RULEPACK_TOO_LARGE")

    normalized: list[tuple[int, bytes, bytes]] = []
    total = 0
    for raw in patches:
        try:
            offset = int(raw.get("offset"))
            before = bytes.fromhex(str(raw.get("beforeHex") or raw.get("before_hex") or ""))
            after = bytes.fromhex(str(raw.get("afterHex") or raw.get("after_hex") or ""))
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
        normalized.append((offset, before, after))

    normalized.sort(key=lambda item: item[0])
    previous_end = -1
    for offset, before, _after in normalized:
        if offset < previous_end:
            raise ValueError("PATCH_RULES_OVERLAP")
        previous_end = offset + len(before)

    out = bytearray(ori)
    changes: list[MutationChange] = []
    allowed: list[tuple[int, int]] = []
    for offset, before, after in normalized:
        end = offset + len(before)
        current = bytes(out[offset:end])
        if current != before:
            raise ValueError(f"PATCH_PRECONDITION_MISMATCH:{offset}")
        changed = sum(1 for left, right in zip(before, after) if left != right)
        if not changed:
            continue
        out[offset:end] = after
        allowed.append((offset, end))
        changes.append(MutationChange("EXACT_PATCH", offset, len(before), changed, 0.0))

    if not changes:
        raise ValueError("PATCH_NO_CHANGES")
    return MutationResult(data=bytes(out), changes=changes, allowed_ranges=allowed)
