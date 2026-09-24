import random

from ecu_worker.maps import extract_map_candidates, extract_map_candidates_multiendian


def _u16be(values):
    return b''.join(int(value).to_bytes(2, 'big') for value in values)


def test_extracts_smooth_monotonic_8x8_candidate():
    values = [1000 + row * 50 + col * 3 for row in range(8) for col in range(8)]
    prefix = b'\xff' * 32
    data = prefix + _u16be(values) + b'\x00' * 32
    candidates = extract_map_candidates(data, shapes=((8, 8),), min_score=0.8)
    assert candidates
    best = max(candidates, key=lambda candidate: candidate.score)
    assert best.offset == len(prefix)
    assert (best.rows, best.cols) == (8, 8)
    assert best.endian == 'big'
    assert best.score >= 0.8


def test_random_noise_is_rejected_at_high_threshold():
    rng = random.Random(42)
    data = bytes(rng.randrange(0, 256) for _ in range(512))
    candidates = extract_map_candidates(data, shapes=((8, 8),), min_score=0.9)
    assert candidates == []


def _u16le(values):
    return b''.join(int(value).to_bytes(2, 'little') for value in values)


def test_multiendian_discovers_little_endian_map():
    values=[500 + row*40 + col*5 for row in range(8) for col in range(8)]
    prefix=b'\xaa'*24
    data=prefix+_u16le(values)+b'\x00'*24
    candidates=extract_map_candidates_multiendian(
        data,
        shapes=((8,8),),
        min_score=0.8,
    )
    assert candidates
    match=[item for item in candidates if item.offset==len(prefix)]
    assert match
    assert match[0].endian=='little'


def test_multiendian_deduplicates_overlapping_interpretations():
    values=[1000 + row*30 + col*2 for row in range(8) for col in range(8)]
    data=_u16be(values)
    candidates=extract_map_candidates_multiendian(
        data,
        shapes=((8,8),),
        min_score=0.8,
    )
    covering=[item for item in candidates if item.offset==0]
    assert len(covering)<=1


def test_axis_table_scanner_finds_structural_map():
    from ecu_worker.maps import extract_structural_map_candidates

    x=[0,500,1000,1500,2000,2500,3000,3500]
    y=[0,20,40,60,80,100]
    table=[1000 + row*50 + col*7 for row in range(len(y)) for col in range(len(x))]
    data=b'\xff'*32 + _u16be(x) + _u16be(y) + _u16be(table) + b'\x00'*32

    candidates=extract_structural_map_candidates(
        data,
        endians=('big',),
        min_axis_score=0.35,
        min_table_score=0.35,
    )
    assert candidates
    best=max(candidates,key=lambda item:item.score)
    assert best.source=='axis-table'
    assert best.x_axis_offset==32
    assert best.y_axis_offset==32+len(x)*2
    assert best.offset==32+len(x)*2+len(y)*2
    assert best.cols==len(x)
    assert best.rows==len(y)
    assert best.endian=='big'


def test_large_binary_multiendian_skips_expensive_surface_scan(monkeypatch):
    import ecu_worker.maps as maps

    called={'surface':0}
    original=maps.extract_map_candidates
    def spy(*args,**kwargs):
        called['surface']+=1
        return original(*args,**kwargs)
    monkeypatch.setattr(maps,'extract_map_candidates',spy)

    data=bytes(300_000)
    maps.extract_map_candidates_multiendian(data,surface_scan_limit_bytes=262_144)
    assert called['surface']==0


def test_structural_scanner_finds_axis_vector():
    from ecu_worker.maps import extract_structural_map_candidates
    x=[0,500,1000,1500,2000,2500,3000,3500]
    curve=[300,320,340,360,380,400,420,440]
    data=b'\xff'*16+_u16be(x)+_u16be(curve)+b'\x00'*16
    candidates=extract_structural_map_candidates(
        data,
        endians=('big',),
        min_axis_score=0.35,
        min_table_score=0.35,
    )
    vectors=[item for item in candidates if item.source=='axis-vector' and item.x_axis_offset==16]
    assert vectors
    best=max(vectors,key=lambda item:item.score)
    assert best.rows==1
    assert best.cols==len(x)
    assert best.offset==16+len(x)*2
