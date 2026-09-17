import random

from ecu_worker.maps import extract_map_candidates


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
