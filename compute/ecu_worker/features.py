from __future__ import annotations

from collections import Counter
from math import log2


def byte_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = Counter(data)
    n = len(data)
    return -sum((c / n) * log2(c / n) for c in counts.values())


def printable_strings(data: bytes, min_length: int = 4) -> list[str]:
    out: list[str] = []
    buf: list[str] = []
    for byte in data:
        if 32 <= byte <= 126:
            buf.append(chr(byte))
        else:
            if len(buf) >= min_length:
                out.append(''.join(buf))
            buf = []
    if len(buf) >= min_length:
        out.append(''.join(buf))
    return out
