from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal
import zlib


@dataclass(frozen=True)
class ChecksumResult:
    status: Literal["VERIFIED", "UNSUPPORTED", "FAILED", "NOT_REQUIRED"]
    algorithm: str | None
    verified: bool


@dataclass(frozen=True)
class ChecksumApplyResult:
    data: bytes
    ranges: list[tuple[int, int]]
    result: ChecksumResult


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

    def apply(self, data: bytes) -> ChecksumApplyResult:
        return ChecksumApplyResult(data=data, ranges=[], result=self.verify(data))


class ProfileChecksumAdapter(ChecksumAdapter):
    """Checksum implementation driven by an explicitly verified ECU/HW/SW profile."""

    SUPPORTED = {"sum16", "sum32", "crc32"}

    def __init__(self, profile: dict):
        self.profile = dict(profile or {})
        self.algorithm = str(self.profile.get("algorithm") or "").lower()
        self.data_start = int(self.profile.get("data_start", 0))
        self.data_end = int(self.profile.get("data_end", 0))
        self.checksum_offset = int(self.profile.get("checksum_offset", 0))
        self.checksum_size = int(self.profile.get("checksum_size", 0))
        self.endian = str(self.profile.get("endian") or "big").lower()
        self.zero_field = bool(self.profile.get("zero_field", True))
        self.name = f"profile-{self.algorithm}"

    def _validate_profile(self, data: bytes) -> bool:
        return (
            self.algorithm in self.SUPPORTED
            and self.endian in {"big", "little"}
            and self.data_start >= 0
            and self.data_end > self.data_start
            and self.data_end <= len(data)
            and self.checksum_offset >= 0
            and self.checksum_size in {2, 4}
            and self.checksum_offset + self.checksum_size <= len(data)
        )

    def _work_bytes(self, data: bytes) -> bytes:
        work = bytearray(data[self.data_start:self.data_end])
        if self.zero_field:
            field_start = self.checksum_offset - self.data_start
            field_end = field_start + self.checksum_size
            if field_start >= 0 and field_end <= len(work):
                work[field_start:field_end] = b"\x00" * self.checksum_size
        return bytes(work)

    def _value(self, data: bytes) -> int:
        work = self._work_bytes(data)
        if self.algorithm == "sum16":
            return sum(work) & 0xFFFF
        if self.algorithm == "sum32":
            return sum(work) & 0xFFFFFFFF
        if self.algorithm == "crc32":
            return zlib.crc32(work) & 0xFFFFFFFF
        raise ValueError("CHECKSUM_ALGORITHM_UNSUPPORTED")

    def verify(self, data: bytes) -> ChecksumResult:
        if not self._validate_profile(data):
            return ChecksumResult(status="FAILED", algorithm=self.name, verified=False)
        expected = self._value(data)
        actual = int.from_bytes(
            data[self.checksum_offset:self.checksum_offset + self.checksum_size],
            self.endian,
            signed=False,
        )
        verified = expected == actual
        return ChecksumResult(
            status="VERIFIED" if verified else "FAILED",
            algorithm=self.name,
            verified=verified,
        )

    def apply(self, data: bytes) -> ChecksumApplyResult:
        if not self._validate_profile(data):
            return ChecksumApplyResult(
                data=data,
                ranges=[],
                result=ChecksumResult(status="FAILED", algorithm=self.name, verified=False),
            )
        value = self._value(data)
        max_value = (1 << (self.checksum_size * 8)) - 1
        if value > max_value:
            return ChecksumApplyResult(
                data=data,
                ranges=[],
                result=ChecksumResult(status="FAILED", algorithm=self.name, verified=False),
            )
        out = bytearray(data)
        out[self.checksum_offset:self.checksum_offset + self.checksum_size] = value.to_bytes(
            self.checksum_size,
            self.endian,
            signed=False,
        )
        repaired = bytes(out)
        result = self.verify(repaired)
        return ChecksumApplyResult(
            data=repaired,
            ranges=[(self.checksum_offset, self.checksum_offset + self.checksum_size)],
            result=result,
        )


class ChecksumRegistry:
    """Family-scoped checksum adapters. Nothing is inferred or auto-enabled."""

    def __init__(self, adapters: dict[str, ChecksumAdapter] | None = None):
        self._adapters = {str(key).upper(): value for key, value in (adapters or {}).items()}

    def adapter_for(self, ecu_family: str) -> ChecksumAdapter:
        return self._adapters.get(str(ecu_family or "").upper(), ChecksumAdapter())

    def verify(self, ecu_family: str, data: bytes) -> ChecksumResult:
        return self.adapter_for(ecu_family).verify(data)
