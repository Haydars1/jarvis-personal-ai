from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256


@dataclass(frozen=True)
class ChangedRange:
    start: int
    end: int
    deltas: list[int]


@dataclass(frozen=True)
class DiffReport:
    original_size: int
    modified_size: int
    changed_byte_count: int
    ranges: list[ChangedRange]
    digest: str


def _digest(ori: bytes, mod: bytes) -> str:
    hasher = sha256()
    hasher.update(len(ori).to_bytes(8, 'big'))
    hasher.update(ori)
    hasher.update(mod)
    return hasher.hexdigest()


def diff_bytes(ori: bytes, mod: bytes) -> DiffReport:
    if len(ori) != len(mod):
        raise ValueError('ECU_BINARY_SIZE_MISMATCH')

    changed = [index for index, (left, right) in enumerate(zip(ori, mod)) if left != right]
    ranges: list[ChangedRange] = []

    if changed:
        start = changed[0]
        previous = changed[0]
        offsets = [changed[0]]

        for index in changed[1:]:
            if index == previous + 1:
                offsets.append(index)
            else:
                ranges.append(
                    ChangedRange(
                        start=start,
                        end=previous + 1,
                        deltas=[mod[offset] - ori[offset] for offset in offsets],
                    )
                )
                start = index
                offsets = [index]
            previous = index

        ranges.append(
            ChangedRange(
                start=start,
                end=previous + 1,
                deltas=[mod[offset] - ori[offset] for offset in offsets],
            )
        )

    return DiffReport(
        original_size=len(ori),
        modified_size=len(mod),
        changed_byte_count=len(changed),
        ranges=ranges,
        digest=_digest(ori, mod),
    )


def _map_byte_span(candidate: dict) -> tuple[int, int] | None:
    try:
        offset=int(candidate.get("offset") or 0)
        rows=int(candidate.get("rows") or 0)
        cols=int(candidate.get("cols") or 0)
    except (TypeError,ValueError):
        return None
    if rows<=0 or cols<=0:
        return None
    width=2 if str(candidate.get("data_type") or "u16").lower() in {"u16","s16"} else 1
    end=offset+rows*cols*width
    return (offset,end) if end>offset else None


def link_ranges_to_maps(report: DiffReport, maps: list[dict]) -> list[dict]:
    linked: list[dict] = []
    for changed in report.ranges:
        hits: list[dict] = []
        for candidate in maps:
            span=_map_byte_span(candidate)
            if span is None:
                continue
            start,end=span
            overlap=max(0,min(changed.end,end)-max(changed.start,start))
            if overlap<=0:
                continue
            hits.append({
                "offset":start,
                "end":end,
                "semantic_label":str(candidate.get("semantic_label") or "UNKNOWN"),
                "semantic_confidence":float(candidate.get("semantic_confidence") or candidate.get("confidence") or 0.0),
                "human_verified":bool(candidate.get("human_verified") or candidate.get("humanVerified") or False),
                "overlap_bytes":overlap,
            })
        hits.sort(key=lambda item:(-item["overlap_bytes"],-item["semantic_confidence"],item["offset"]))
        linked.append({
            "start":changed.start,
            "end":changed.end,
            "deltas":changed.deltas,
            "map_hits":hits,
        })
    return linked


def measure_verified_map_deltas(ori: bytes, mod: bytes, maps: list[dict]) -> list[dict]:
    if len(ori) != len(mod):
        raise ValueError("ECU_BINARY_SIZE_MISMATCH")
    out: list[dict] = []
    for candidate in maps:
        label=str(candidate.get("semantic_label") or candidate.get("semanticLabel") or "UNKNOWN")
        verified=bool(candidate.get("human_verified") or candidate.get("humanVerified") or False)
        data_type=str(candidate.get("data_type") or candidate.get("dataType") or "").lower()
        endian=str(candidate.get("endian") or "big").lower()
        if not verified or label=="UNKNOWN" or data_type not in {"u16","s16"} or endian not in {"big","little"}:
            continue
        try:
            offset=int(candidate.get("offset") or 0)
            rows=int(candidate.get("rows") or 0)
            cols=int(candidate.get("cols") or 0)
        except (TypeError,ValueError):
            continue
        count=rows*cols
        if count<=0 or offset<0 or offset+count*2>len(ori):
            continue

        abs_percents: list[float] = []
        signed_percents: list[float] = []
        changed_cells=0
        signed = data_type=="s16"
        for index in range(count):
            start=offset+index*2
            before=int.from_bytes(ori[start:start+2],endian,signed=signed)
            after=int.from_bytes(mod[start:start+2],endian,signed=signed)
            if before==after:
                continue
            changed_cells+=1
            if before==0:
                continue
            signed_percent=(after-before)/before*100.0
            signed_percents.append(signed_percent)
            abs_percents.append(abs(signed_percent))

        if changed_cells==0:
            continue
        ordered=sorted(abs_percents)
        if ordered:
            p95_index=min(len(ordered)-1,max(0,int(round((len(ordered)-1)*0.95))))
            mean_abs=sum(ordered)/len(ordered)
            max_abs=max(ordered)
            p95_abs=ordered[p95_index]
        else:
            mean_abs=max_abs=p95_abs=0.0

        ordered_signed=sorted(signed_percents)
        median_signed=(ordered_signed[len(ordered_signed)//2] if len(ordered_signed)%2 else ((ordered_signed[len(ordered_signed)//2-1]+ordered_signed[len(ordered_signed)//2])/2)) if ordered_signed else 0.0

        out.append({
            "semantic_label":label,
            "map_offset":offset,
            "changed_cells":changed_cells,
            "measured_cells":len(ordered),
            "mean_abs_percent":mean_abs,
            "max_abs_percent":max_abs,
            "p95_abs_percent":p95_abs,
            "median_signed_percent":median_signed,
            "semantic_confidence":float(candidate.get("semantic_confidence") or candidate.get("confidence") or 0.0),
            "human_verified":True,
        })
    out.sort(key=lambda item:(item["semantic_label"],item["map_offset"]))
    return out
