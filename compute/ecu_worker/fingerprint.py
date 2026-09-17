from __future__ import annotations

from dataclasses import dataclass, field
import re

from .features import printable_strings


@dataclass(frozen=True)
class FingerprintResult:
    ecu_family: str = 'UNKNOWN'
    hw_candidates: list[str] = field(default_factory=list)
    sw_candidates: list[str] = field(default_factory=list)
    confidence: float = 0.0
    evidence: list[str] = field(default_factory=list)
    supported: bool = False


def _extract_prefixed(strings: list[str], prefix: str) -> list[str]:
    values: list[str] = []
    pattern = re.compile(rf'\b{re.escape(prefix)}\s*[:=_-]?\s*([A-Z0-9.-]{{6,24}})', re.I)
    for text in strings:
        values.extend(match.group(1) for match in pattern.finditer(text))
    return list(dict.fromkeys(values))


def fingerprint_binary(data: bytes) -> FingerprintResult:
    strings = printable_strings(data, min_length=4)
    joined = '\n'.join(strings)
    hw_candidates = _extract_prefixed(strings, 'HW')
    sw_candidates = _extract_prefixed(strings, 'SW')

    if re.search(r'\bEDC17C46\b', joined, re.I):
        evidence = ['explicit marker: EDC17C46']
        if re.search(r'\bBOSCH\b', joined, re.I):
            evidence.append('vendor marker: BOSCH')
        return FingerprintResult(
            ecu_family='EDC17C46',
            hw_candidates=hw_candidates,
            sw_candidates=sw_candidates,
            confidence=0.95,
            evidence=evidence,
            supported=True,
        )

    return FingerprintResult(hw_candidates=hw_candidates, sw_candidates=sw_candidates)
