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
