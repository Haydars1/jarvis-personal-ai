from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


@dataclass(frozen=True)
class ChecksumResult:
    status: Literal["VERIFIED", "UNSUPPORTED", "FAILED", "NOT_REQUIRED"]
    algorithm: str | None
    verified: bool


@dataclass(frozen=True)
class ValidationResult:
    ready: bool
    errors: list[str] = field(default_factory=list)
    changed_offsets: list[int] = field(default_factory=list)
    checksum: ChecksumResult | None = None


def _offset_allowed(offset: int, allowed_ranges: list[tuple[int, int]]) -> bool:
    return any(start <= offset < end for start, end in allowed_ranges)


def validate_mod_candidate(
    ori: bytes,
    mod: bytes,
    *,
    allowed_ranges: list[tuple[int, int]],
    checksum: ChecksumResult,
) -> ValidationResult:
    errors: list[str] = []
    if len(ori) != len(mod):
        return ValidationResult(
            ready=False,
            errors=["FILE_SIZE_MISMATCH"],
            changed_offsets=[],
            checksum=checksum,
        )

    changed_offsets = [index for index, (a, b) in enumerate(zip(ori, mod)) if a != b]
    if any(not _offset_allowed(offset, allowed_ranges) for offset in changed_offsets):
        errors.append("UNKNOWN_EDIT")

    if checksum.status == "UNSUPPORTED":
        errors.append("CHECKSUM_UNSUPPORTED")
    elif checksum.status == "FAILED" or not checksum.verified:
        if checksum.status not in {"NOT_REQUIRED"}:
            errors.append("CHECKSUM_NOT_VERIFIED")

    ready = not errors
    return ValidationResult(
        ready=ready,
        errors=errors,
        changed_offsets=changed_offsets,
        checksum=checksum,
    )


class ChecksumAdapter:
    """Explicit interface. ECU-specific algorithms must be implemented and verified separately."""

    name = "unsupported"

    def verify(self, _data: bytes) -> ChecksumResult:
        return ChecksumResult(status="UNSUPPORTED", algorithm=None, verified=False)
