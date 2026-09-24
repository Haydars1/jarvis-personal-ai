from __future__ import annotations

from dataclasses import dataclass
from statistics import median

from .maps import MapCandidate


@dataclass(frozen=True)
class HeuristicSemantic:
    label: str
    confidence: float
    evidence: tuple[str, ...] = ()


def _read_u16(data: bytes, offset: int | None, count: int, endian: str) -> list[int]:
    if offset is None or offset < 0 or count <= 0:
        return []
    end=offset+count*2
    if end>len(data):
        return []
    return [
        int.from_bytes(data[offset+i*2:offset+i*2+2],endian)
        for i in range(count)
    ]


def _profile(values: list[int]) -> tuple[str,float]:
    if len(values)<4:
        return "other",0.0
    if any(b<=a for a,b in zip(values,values[1:])):
        return "other",0.0
    steps=[b-a for a,b in zip(values,values[1:])]
    med=float(median(steps))
    first=float(values[0])
    last=float(values[-1])

    scores={
        "rpm": (
            (1.0 if 2500<=last<=8000 else 0.0)
            + (0.5 if first<=1500 else 0.0)
            + (0.5 if 50<=med<=1000 else 0.0)
        )/2.0,
        "throttle": (
            (1.0 if 70<=last<=110 else 0.0)
            + (0.5 if first<=20 else 0.0)
            + (0.5 if 1<=med<=20 else 0.0)
        )/2.0,
        "load": (
            (1.0 if 40<=last<=250 else 0.0)
            + (0.5 if first<=50 else 0.0)
            + (0.5 if 1<=med<=50 else 0.0)
        )/2.0,
    }
    label,score=max(scores.items(),key=lambda item:item[1])
    return (label,score) if score>=0.6 else ("other",score)


def _fuel_type(ecu_family: str) -> str | None:
    family=str(ecu_family or "").upper()
    if family.startswith(("EDC","MD1","SID","DCM","MJD")):
        return "diesel"
    if family.startswith(("MED","ME","MG1","SIMOS","IAW")):
        return "petrol"
    return None


def classify_map_heuristic(data: bytes, candidate: MapCandidate, ecu_family: str) -> HeuristicSemantic:
    if candidate.source not in {"axis-table","axis-vector"} or candidate.x_axis_offset is None:
        return HeuristicSemantic("UNKNOWN",0.0)

    x=_read_u16(data,candidate.x_axis_offset,candidate.cols,candidate.endian)
    y=_read_u16(data,candidate.y_axis_offset,candidate.rows,candidate.endian) if candidate.y_axis_offset is not None else []
    if not x:
        return HeuristicSemantic("UNKNOWN",0.0)

    x_profile,x_score=_profile(x)
    y_profile,y_score=_profile(y) if y else ("other",0.0)
    count=candidate.rows*candidate.cols
    cells=_read_u16(data,candidate.offset,count,candidate.endian)
    if not cells:
        return HeuristicSemantic("UNKNOWN",0.0)

    cell_min=min(cells)
    cell_max=max(cells)
    cell_med=float(median(cells))
    plateau=sum(1 for value in cells if value>=cell_max*0.98)/len(cells) if cell_max else 0.0
    axis_pair={x_profile,y_profile}
    quality=min(1.0,0.55*candidate.axis_score+0.45*candidate.smoothness)
    fuel=_fuel_type(ecu_family)

    if candidate.source=="axis-vector":
        if x_profile=="rpm" and 120<=cell_max<=1800 and quality>=0.58:
            confidence=min(0.92,0.88+0.03*quality+0.01*x_score)
            return HeuristicSemantic(
                "torque_limiter",
                round(confidence,3),
                ("axis-vector rpm curve",f"cell-range:{cell_min}-{cell_max}"),
            )
        return HeuristicSemantic("UNKNOWN",0.0)

    # Driver-wish maps are commonly RPM x pedal/load and produce a bounded
    # requested torque/quantity surface. Keep this deliberately conservative.
    if "rpm" in axis_pair and "throttle" in axis_pair and 50<=cell_max<=1500 and quality>=0.52:
        confidence=min(0.94,0.88+0.04*min(x_score+y_score,2.0)/2.0+0.02*quality)
        return HeuristicSemantic(
            "driver_wish",
            round(confidence,3),
            ("rpm+throttle axes",f"cell-range:{cell_min}-{cell_max}"),
        )

    # A plateau-heavy RPM/load surface in torque-like numeric ranges is a
    # strong torque-limiter candidate.
    if "rpm" in axis_pair and ("load" in axis_pair or "throttle" in axis_pair) and 150<=cell_max<=1800 and plateau>=0.30 and quality>=0.55:
        confidence=min(0.93,0.88+0.03*quality+0.02*min(1.0,plateau))
        return HeuristicSemantic(
            "torque_limiter",
            round(confidence,3),
            ("rpm+load axes",f"plateau:{plateau:.2f}",f"cell-max:{cell_max}"),
        )

    # Boost target candidates tend to be smooth RPM/load surfaces around
    # absolute-pressure ranges. This is a suggestion only until rulepack
    # evidence repeats across verified ORI/MOD pairs.
    if "rpm" in axis_pair and ("load" in axis_pair or "throttle" in axis_pair) and 900<=cell_med<=3200 and 1200<=cell_max<=4500 and quality>=0.60:
        confidence=min(0.92,0.88+0.03*quality+0.01*min(x_score+y_score,2.0)/2.0)
        return HeuristicSemantic(
            "boost_target",
            round(confidence,3),
            ("rpm+load axes",f"median:{cell_med:.0f}",f"cell-max:{cell_max}"),
        )

    if fuel=="diesel" and "rpm" in axis_pair and "load" in axis_pair and 300<=cell_med<=2200 and 800<=cell_max<=3000 and quality>=0.68:
        confidence=min(0.91,0.87+0.04*quality)
        return HeuristicSemantic(
            "rail_pressure",
            round(confidence,3),
            ("diesel rpm+load axes",f"median:{cell_med:.0f}",f"cell-max:{cell_max}"),
        )

    return HeuristicSemantic("UNKNOWN",0.0)
