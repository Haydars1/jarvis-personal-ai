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
