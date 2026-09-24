from __future__ import annotations

from dataclasses import dataclass
from statistics import mean


@dataclass(frozen=True)
class MapCandidate:
    offset: int
    rows: int
    cols: int
    endian: str
    min_value: int
    max_value: int
    unique_ratio: float
    smoothness: float
    score: float


def _decode_u16(data: bytes, offset: int, count: int, endian: str) -> list[int]:
    out: list[int] = []
    for index in range(count):
        start = offset + index * 2
        out.append(int.from_bytes(data[start:start + 2], endian))
    return out


def _monotonic_ratio(lines: list[list[int]]) -> float:
    if not lines:
        return 0.0
    monotonic = 0
    for line in lines:
        non_decreasing = all(a <= b for a, b in zip(line, line[1:]))
        non_increasing = all(a >= b for a, b in zip(line, line[1:]))
        if non_decreasing or non_increasing:
            monotonic += 1
    return monotonic / len(lines)


def _score(values: list[int], rows: int, cols: int) -> tuple[float, float, float]:
    span = max(values) - min(values)
    if span < 20:
        return 0.0, 0.0, 0.0

    grid = [values[row * cols:(row + 1) * cols] for row in range(rows)]
    columns = [[grid[row][col] for row in range(rows)] for col in range(cols)]
    row_ratio = _monotonic_ratio(grid)
    col_ratio = _monotonic_ratio(columns)
    unique_ratio = len(set(values)) / len(values)

    neighbor_deltas: list[int] = []
    for row in grid:
        neighbor_deltas.extend(abs(a - b) for a, b in zip(row, row[1:]))
    for column in columns:
        neighbor_deltas.extend(abs(a - b) for a, b in zip(column, column[1:]))
    avg_delta = mean(neighbor_deltas) if neighbor_deltas else span
    normalized_delta = avg_delta / span if span else 1.0
    smoothness = max(0.0, 1.0 - min(1.0, normalized_delta * 5.0))

    score = (
        0.35 * row_ratio
        + 0.35 * col_ratio
        + 0.15 * min(1.0, unique_ratio * 1.5)
        + 0.15 * smoothness
    )
    return score, unique_ratio, smoothness


def extract_map_candidates(
    data: bytes,
    *,
    shapes: tuple[tuple[int, int], ...] = ((8, 8), (12, 12), (16, 16)),
    min_score: float = 0.85,
    endian: str = 'big',
) -> list[MapCandidate]:
    candidates: list[MapCandidate] = []
    for rows, cols in shapes:
        byte_count = rows * cols * 2
        if byte_count > len(data):
            continue
        for offset in range(0, len(data) - byte_count + 1, 2):
            values = _decode_u16(data, offset, rows * cols, endian)
            score, unique_ratio, smoothness = _score(values, rows, cols)
            if score < min_score:
                continue
            candidates.append(MapCandidate(
                offset=offset,
                rows=rows,
                cols=cols,
                endian=endian,
                min_value=min(values),
                max_value=max(values),
                unique_ratio=unique_ratio,
                smoothness=smoothness,
                score=round(score, 6),
            ))

    candidates.sort(key=lambda item: (-item.score, item.offset, item.rows, item.cols))
    selected: list[MapCandidate] = []
    for candidate in candidates:
        size = candidate.rows * candidate.cols * 2
        if any(abs(candidate.offset - kept.offset) < min(size, kept.rows * kept.cols * 2) // 2 for kept in selected):
            continue
        selected.append(candidate)
    return selected


def extract_map_candidates_multiendian(
    data: bytes,
    *,
    shapes: tuple[tuple[int, int], ...] = ((8, 8), (12, 12), (16, 16)),
    min_score: float = 0.85,
    endians: tuple[str, ...] = ("big", "little"),
    max_candidates: int = 256,
) -> list[MapCandidate]:
    merged: list[MapCandidate] = []
    for endian in endians:
        if endian not in {"big", "little"}:
            continue
        merged.extend(extract_map_candidates(
            data,
            shapes=shapes,
            min_score=min_score,
            endian=endian,
        ))

    merged.sort(key=lambda item: (-item.score, item.offset, item.rows, item.cols, item.endian))
    selected: list[MapCandidate] = []
    for candidate in merged:
        candidate_size = candidate.rows * candidate.cols * 2
        conflict = False
        for kept in selected:
            kept_size = kept.rows * kept.cols * 2
            left=max(candidate.offset,kept.offset)
            right=min(candidate.offset+candidate_size,kept.offset+kept_size)
            overlap=max(0,right-left)
            if overlap >= min(candidate_size,kept_size)*0.75:
                conflict=True
                break
        if conflict:
            continue
        selected.append(candidate)
        if len(selected)>=max_candidates:
            break
    return selected
