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


_KNOWN_FAMILIES = [
    (r'\bEDC17[A-Z0-9.-]*\b', 'EDC17'),
    (r'\bMED17[A-Z0-9.-]*\b', 'MED17'),
    (r'\bEDC16[A-Z0-9.-]*\b', 'EDC16'),
    (r'\bMD1[A-Z0-9.-]*\b', 'MD1'),
    (r'\bMG1[A-Z0-9.-]*\b', 'MG1'),
    (r'\bSID[0-9A-Z.-]+\b', 'SID'),
    (r'\bDCM[0-9A-Z.-]+\b', 'DCM'),
    (r'\bIAW[0-9A-Z.-]+\b', 'MARELLI_IAW'),
]

def fingerprint_binary(data: bytes) -> FingerprintResult:
    strings = printable_strings(data, min_length=4)
    joined = '\n'.join(strings)
    hw_candidates = _extract_prefixed(strings, 'HW')
    sw_candidates = _extract_prefixed(strings, 'SW')

    for pattern, prefix in _KNOWN_FAMILIES:
        match=re.search(pattern, joined, re.I)
        if not match:
            continue
        family=match.group(0).upper()
        evidence=[f'explicit marker: {family}']
        if re.search(r'\bBOSCH\b', joined, re.I):
            evidence.append('vendor marker: BOSCH')
        if re.search(r'\bCONTINENTAL\b|\bSIEMENS\b', joined, re.I):
            evidence.append('vendor marker: CONTINENTAL/SIEMENS')
        if re.search(r'\bDELPHI\b', joined, re.I):
            evidence.append('vendor marker: DELPHI')
        if re.search(r'\bMARELLI\b', joined, re.I):
            evidence.append('vendor marker: MARELLI')
        return FingerprintResult(
            ecu_family=family,
            hw_candidates=hw_candidates,
            sw_candidates=sw_candidates,
            confidence=0.92 if prefix!='EDC17' else 0.95,
            evidence=evidence,
            supported=True,
        )

    return FingerprintResult(hw_candidates=hw_candidates, sw_candidates=sw_candidates)
