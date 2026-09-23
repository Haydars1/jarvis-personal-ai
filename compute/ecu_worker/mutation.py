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
