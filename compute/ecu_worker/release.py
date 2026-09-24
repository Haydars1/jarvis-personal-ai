from __future__ import annotations

from dataclasses import dataclass, field

from .validation import ChecksumAdapter, validate_mod_candidate


@dataclass(frozen=True)
class ReleaseDecision:
    ready: bool
    errors: list[str] = field(default_factory=list)
    mod_bytes: bytes | None = None
    changed_offsets: list[int] = field(default_factory=list)
    checksum_algorithm: str | None = None


def build_release_decision(
    ori: bytes,
    candidate_mod: bytes,
    *,
    allowed_ranges: list[tuple[int,int]],
    checksum_adapter: ChecksumAdapter,
) -> ReleaseDecision:
    applied=checksum_adapter.apply(candidate_mod)
    effective_ranges=list(allowed_ranges)+list(applied.ranges)
    validation=validate_mod_candidate(
        ori,
        applied.data,
        allowed_ranges=effective_ranges,
        checksum=applied.result,
    )
    return ReleaseDecision(
        ready=validation.ready,
        errors=list(validation.errors),
        mod_bytes=applied.data if validation.ready else None,
        changed_offsets=list(validation.changed_offsets),
        checksum_algorithm=applied.result.algorithm,
    )
