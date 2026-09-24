from ecu_worker.map_heuristics import classify_map_heuristic
from ecu_worker.maps import MapCandidate


def _u16be(values):
    return b"".join(int(v).to_bytes(2,"big") for v in values)


def candidate(offset,xoff,yoff,rows,cols,minv,maxv,smooth=.8,axis=.8):
    return MapCandidate(
        offset=offset,
        rows=rows,
        cols=cols,
        endian="big",
        min_value=minv,
        max_value=maxv,
        unique_ratio=.8,
        smoothness=smooth,
        score=.85,
        x_axis_offset=xoff,
        y_axis_offset=yoff,
        axis_score=axis,
        source="axis-table",
    )


def test_driver_wish_heuristic_requires_rpm_and_throttle_axes():
    x=[0,500,1000,1500,2000,2500,3000,3500]
    y=[0,20,40,60,80,100]
    cells=[100+row*100+col*10 for row in range(len(y)) for col in range(len(x))]
    xoff=0
    yoff=len(x)*2
    off=yoff+len(y)*2
    data=_u16be(x)+_u16be(y)+_u16be(cells)
    result=classify_map_heuristic(
        data,
        candidate(off,xoff,yoff,len(y),len(x),min(cells),max(cells)),
        "EDC17C46",
    )
    assert result.label=="driver_wish"
    assert result.confidence>=.90


def test_boost_target_heuristic_uses_pressure_like_cell_range():
    x=[0,500,1000,1500,2000,2500,3000,3500]
    y=[0,20,40,60,80,100]
    cells=[1000+row*220+col*20 for row in range(len(y)) for col in range(len(x))]
    xoff=0
    yoff=len(x)*2
    off=yoff+len(y)*2
    data=_u16be(x)+_u16be(y)+_u16be(cells)
    result=classify_map_heuristic(
        data,
        candidate(off,xoff,yoff,len(y),len(x),min(cells),max(cells),smooth=.9,axis=.9),
        "EDC17C46",
    )
    assert result.label in {"boost_target","rail_pressure"}
    assert result.confidence>=.90


def test_surface_only_candidate_is_never_semantically_promoted():
    cells=[1000+i for i in range(64)]
    data=_u16be(cells)
    item=MapCandidate(
        offset=0,rows=8,cols=8,endian="big",
        min_value=min(cells),max_value=max(cells),
        unique_ratio=1.0,smoothness=.9,score=.95,
    )
    result=classify_map_heuristic(data,item,"EDC17C46")
    assert result.label=="UNKNOWN"
    assert result.confidence==0.0
