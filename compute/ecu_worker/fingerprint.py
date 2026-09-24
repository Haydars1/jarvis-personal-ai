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
    (r'\bMEDC17[A-Z0-9.-]*\b', 'MEDC17', 'BOSCH'),
    (r'\bEDC17[A-Z0-9.-]*\b', 'EDC17', 'BOSCH'),
    (r'\bMED17[A-Z0-9.-]*\b', 'MED17', 'BOSCH'),
    (r'\bME17[A-Z0-9.-]*\b', 'ME17', 'BOSCH'),
    (r'\bEDC16[A-Z0-9.-]*\b', 'EDC16', 'BOSCH'),
    (r'\bEDC15[A-Z0-9.-]*\b', 'EDC15', 'BOSCH'),
    (r'\bMED9[A-Z0-9.-]*\b', 'MED9', 'BOSCH'),
    (r'\bME7(?:\.[0-9A-Z.-]+|[0-9A-Z.-]+)?\b', 'ME7', 'BOSCH'),
    (r'\bMD1[A-Z0-9.-]*\b', 'MD1', 'BOSCH'),
    (r'\bMG1[A-Z0-9.-]*\b', 'MG1', 'BOSCH'),
    (r'\bSID[0-9A-Z.-]+\b', 'SID', 'CONTINENTAL/SIEMENS'),
    (r'\bSIMOS[0-9A-Z.-]*\b', 'SIMOS', 'CONTINENTAL/SIEMENS'),
    (r'\bDCM[0-9A-Z.-]+\b', 'DCM', 'DELPHI'),
    (r'\bIAW[0-9A-Z.-]+\b', 'MARELLI_IAW', 'MARELLI'),
    (r'\bMJD[0-9A-Z.-]+\b', 'MARELLI_MJD', 'MARELLI'),
    (r'\bSH70(?:55|58)\b', 'DENSO_SH70', 'DENSO'),
]

def fingerprint_binary(data: bytes) -> FingerprintResult:
    strings = printable_strings(data, min_length=4)
    joined = '\n'.join(strings)
    hw_candidates = _extract_prefixed(strings, 'HW')
    sw_candidates = _extract_prefixed(strings, 'SW')

    vendor_markers=[]
    if re.search(r'\bBOSCH\b', joined, re.I):
        vendor_markers.append('BOSCH')
    if re.search(r'\bCONTINENTAL\b|\bSIEMENS\b', joined, re.I):
        vendor_markers.append('CONTINENTAL/SIEMENS')
    if re.search(r'\bDELPHI\b', joined, re.I):
        vendor_markers.append('DELPHI')
    if re.search(r'\bMARELLI\b', joined, re.I):
        vendor_markers.append('MARELLI')
    if re.search(r'\bDENSO\b', joined, re.I):
        vendor_markers.append('DENSO')

    hits=[]
    for pattern, prefix, expected_vendor in _KNOWN_FAMILIES:
        match=re.search(pattern, joined, re.I)
        if not match:
            continue
        family=match.group(0).upper().rstrip('.-_')
        vendor_match=expected_vendor in vendor_markers
        score=0.86
        if vendor_match:
            score+=0.06
        if hw_candidates:
            score+=0.02
        if sw_candidates:
            score+=0.02
        if prefix in {'EDC17','MEDC17','MED17','MD1','MG1'}:
            score+=0.02
        hits.append((min(score,0.98),family,prefix,expected_vendor))

    if hits:
        hits.sort(key=lambda row:(-row[0],-len(row[1]),row[1]))
        confidence,family,prefix,expected_vendor=hits[0]
        evidence=[f'explicit marker: {family}']
        for vendor in vendor_markers:
            evidence.append(f'vendor marker: {vendor}')
        if expected_vendor not in vendor_markers:
            evidence.append(f'vendor marker missing: expected {expected_vendor}')
        if len(hits)>1:
            evidence.append('alternate family markers: '+', '.join(hit[1] for hit in hits[1:4]))
        return FingerprintResult(
            ecu_family=family,
            hw_candidates=hw_candidates,
            sw_candidates=sw_candidates,
            confidence=round(confidence,3),
            evidence=evidence,
            supported=confidence>=0.86,
        )

    return FingerprintResult(hw_candidates=hw_candidates, sw_candidates=sw_candidates)
