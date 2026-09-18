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
