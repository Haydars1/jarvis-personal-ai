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
    x_axis_offset: int | None = None
    y_axis_offset: int | None = None
    axis_score: float = 0.0
    source: str = "surface"


@dataclass(frozen=True)
class MapAxis:
    offset: int
    length: int
    endian: str
    values: tuple[int, ...]
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



def _axis_score(values: list[int]) -> float:
    if len(values) < 4:
        return 0.0
    steps=[b-a for a,b in zip(values,values[1:])]
    if not steps or any(step<=0 or step>10_000 for step in steps):
        return 0.0
    span=values[-1]-values[0]
    if span<3 or span>65_000:
        return 0.0
    med=sorted(steps)[len(steps)//2]
    if med<=0:
        return 0.0
    spread=max(steps)-min(steps)
    regularity=max(0.0,1.0-min(1.0,spread/max(float(med)*6.0,1.0)))
    length_score=min(1.0,(len(values)-3)/13.0)
    bounded=1.0 if values[-1] <= 20_000 else 0.65
    return round(0.45*regularity+0.35*length_score+0.20*bounded,6)


def scan_map_axes(
    data: bytes,
    *,
    endian: str,
    min_axis_length: int = 4,
    max_axis_length: int = 32,
    min_step: int = 1,
    max_step: int = 10_000,
    max_axes: int = 4096,
) -> list[MapAxis]:
    if endian not in {"big","little"} or len(data)<min_axis_length*2:
        return []
    axes: list[MapAxis]=[]
    run_start=0
    run_values: list[int]=[]
    previous: int | None=None

    def flush() -> None:
        nonlocal run_values,run_start
        n=len(run_values)
        if n<min_axis_length:
            run_values=[]
            return
        limit=min(n,max_axis_length)
        lengths={limit}
        for common in (4,5,6,8,10,12,16,20,24,32):
            if min_axis_length<=common<=limit:
                lengths.add(common)
        for length in sorted(lengths):
            values=run_values[:length]
            score=_axis_score(values)
            if score<0.35:
                continue
            axes.append(MapAxis(
                offset=run_start,
                length=length,
                endian=endian,
                values=tuple(values),
                score=score,
            ))
            if len(axes)>=max_axes:
                break
        run_values=[]

    for offset in range(0,len(data)-1,2):
        value=int.from_bytes(data[offset:offset+2],endian)
        if previous is None:
            run_start=offset
            run_values=[value]
            previous=value
            continue
        step=value-previous
        if min_step<=step<=max_step and len(run_values)<max_axis_length:
            run_values.append(value)
        else:
            flush()
            if len(axes)>=max_axes:
                break
            run_start=offset
            run_values=[value]
        previous=value
    if len(axes)<max_axes:
        flush()

    # Same bytes interpreted in both endian modes can produce overlapping axes.
    # Keep strongest axes first and suppress near-identical ranges.
    axes.sort(key=lambda item:(-item.score,item.offset,-item.length))
    selected: list[MapAxis]=[]
    for axis in axes:
        end=axis.offset+axis.length*2
        if any(axis.offset==kept.offset and end==kept.offset+kept.length*2 for kept in selected):
            continue
        selected.append(axis)
        if len(selected)>=max_axes:
            break
    selected.sort(key=lambda item:(item.offset,item.length))
    return selected


def _axis_can_extend(data: bytes, axis: MapAxis, *, min_step: int = 1, max_step: int = 10_000) -> bool:
    end=axis.offset+axis.length*2
    if end+2>len(data) or len(axis.values)<2:
        return False
    next_value=int.from_bytes(data[end:end+2],axis.endian)
    next_step=next_value-axis.values[-1]
    if next_step<min_step or next_step>max_step:
        return False
    steps=[b-a for a,b in zip(axis.values,axis.values[1:]) if b>a]
    if not steps:
        return False
    ordered=sorted(steps)
    med=float(ordered[len(ordered)//2])
    # A genuine axis continuation should resemble the existing step pattern.
    # This rejects a short prefix (20,20,20 -> next 20) but accepts the full
    # axis when the next table cell jumps sharply (20 -> 900).
    tolerance=max(float(min_step),med*3.0)
    return abs(float(next_step)-med)<=tolerance


def extract_structural_map_candidates(
    data: bytes,
    *,
    endians: tuple[str,...]=("big","little"),
    min_axis_score: float = 0.40,
    min_table_score: float = 0.45,
    max_axis_gap: int = 8,
    max_data_gap: int = 8,
    max_candidates: int = 512,
) -> list[MapCandidate]:
    candidates: list[MapCandidate]=[]
    for endian in endians:
        axes=[axis for axis in scan_map_axes(data,endian=endian) if axis.score>=min_axis_score]
        if not axes:
            continue
        by_offset: dict[int,list[MapAxis]]={}
        for axis in axes:
            by_offset.setdefault(axis.offset,[]).append(axis)

        for x in axes:
            x_end=x.offset+x.length*2

            # 1D/vector calibration: X axis immediately followed by a vector
            # of the same length. This is common for limiters and curves.
            for data_gap in range(0,max_data_gap+1,2):
                offset=x_end+data_gap
                count=x.length
                end=offset+count*2
                if end>len(data):
                    continue
                values=_decode_u16(data,offset,count,endian)
                if len(set(values))<max(2,count//4) or max(values)-min(values)<20:
                    continue
                steps=[abs(b-a) for a,b in zip(values,values[1:])]
                avg_step=(sum(steps)/len(steps)) if steps else 0.0
                span=max(values)-min(values)
                smooth=max(0.0,1.0-min(1.0,(avg_step/max(float(span),1.0))*5.0))
                unique_ratio=len(set(values))/len(values)
                # A vector has one structural axis instead of two, so keep
                # its confidence below an otherwise comparable 2D axis-table.
                combined=(0.70*x.score+0.20*smooth+0.10*min(1.0,unique_ratio))*0.88
                if combined>=min_table_score:
                    candidates.append(MapCandidate(
                        offset=offset,
                        rows=1,
                        cols=x.length,
                        endian=endian,
                        min_value=min(values),
                        max_value=max(values),
                        unique_ratio=unique_ratio,
                        smoothness=smooth,
                        score=round(min(1.0,combined),6),
                        x_axis_offset=x.offset,
                        y_axis_offset=None,
                        axis_score=x.score,
                        source="axis-vector",
                    ))
                    break

            x_end=x.offset+x.length*2
            y_options: list[MapAxis]=[]
            for gap in range(0,max_axis_gap+1,2):
                y_options.extend(by_offset.get(x_end+gap,[]))
            for y in y_options:
                if y.endian!=endian or y.length<3:
                    continue
                # Prefix axes are emitted intentionally, but a prefix that can
                # still extend into the next u16 word is not a complete axis.
                if _axis_can_extend(data,y):
                    continue
                rows=y.length
                cols=x.length
                if rows>32 or cols>32:
                    continue
                y_end=y.offset+y.length*2
                for data_gap in range(0,max_data_gap+1,2):
                    offset=y_end+data_gap
                    count=rows*cols
                    end=offset+count*2
                    if end>len(data):
                        continue
                    values=_decode_u16(data,offset,count,endian)
                    table_score,unique_ratio,smoothness=_score(values,rows,cols)
                    if unique_ratio<0.05 or max(values)-min(values)<20:
                        continue
                    axis_score=(x.score+y.score)/2.0
                    combined=0.58*axis_score+0.42*table_score
                    if combined<min_table_score:
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
                        score=round(min(1.0,combined),6),
                        x_axis_offset=x.offset,
                        y_axis_offset=y.offset,
                        axis_score=round(axis_score,6),
                        source="axis-table",
                    ))
                    break

    structural_priority={"axis-table":0,"axis-vector":1}
    candidates.sort(key=lambda item:(structural_priority.get(item.source,2),-item.score,item.offset,item.rows,item.cols,item.endian))
    selected: list[MapCandidate]=[]
    for candidate in candidates:
        size=candidate.rows*candidate.cols*2
        overlap=False
        for kept in selected:
            kept_size=kept.rows*kept.cols*2
            left=max(candidate.offset,kept.offset)
            right=min(candidate.offset+size,kept.offset+kept_size)
            if max(0,right-left)>=min(size,kept_size)*0.75:
                overlap=True
                break
        if overlap:
            continue
        selected.append(candidate)
        if len(selected)>=max_candidates:
            break
    return selected

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
    surface_scan_limit_bytes: int = 262_144,
) -> list[MapCandidate]:
    merged: list[MapCandidate] = extract_structural_map_candidates(
        data,
        endians=endians,
        max_candidates=max_candidates*2,
    )
    # Full byte-by-byte surface scanning is intentionally limited to small
    # binaries. On multi-megabyte ECU dumps it is prohibitively expensive;
    # structural axis/table discovery remains linear in file size.
    if len(data) <= surface_scan_limit_bytes:
        for endian in endians:
            if endian not in {"big", "little"}:
                continue
            merged.extend(extract_map_candidates(
                data,
                shapes=shapes,
                min_score=min_score,
                endian=endian,
            ))

    source_priority={"axis-table":0,"surface":1,"axis-vector":2}
    merged.sort(key=lambda item: (source_priority.get(item.source,3),-item.score, item.offset, item.rows, item.cols, item.endian))
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
