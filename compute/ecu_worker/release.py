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
    checksum=checksum_adapter.verify(candidate_mod)
    validation=validate_mod_candidate(
        ori,
        candidate_mod,
        allowed_ranges=allowed_ranges,
        checksum=checksum,
    )
    return ReleaseDecision(
        ready=validation.ready,
        errors=list(validation.errors),
        mod_bytes=candidate_mod if validation.ready else None,
        changed_offsets=list(validation.changed_offsets),
        checksum_algorithm=checksum.algorithm,
    )
