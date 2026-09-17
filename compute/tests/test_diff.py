from ecu_worker.diff import diff_bytes


def test_diff_groups_contiguous_changed_ranges_and_deltas():
    ori = bytes([0, 10, 20, 30, 40, 50, 60, 70])
    mod = bytes([0, 11, 25, 30, 40, 45, 60, 70])

    report = diff_bytes(ori, mod)

    assert report.original_size == 8
    assert report.modified_size == 8
    assert report.changed_byte_count == 3
    assert [(item.start, item.end) for item in report.ranges] == [(1, 3), (5, 6)]
    assert report.ranges[0].deltas == [1, 5]
    assert report.ranges[1].deltas == [-5]


def test_diff_is_deterministic_and_reports_no_changes():
    data = b'\x01\x02\x03\x04'
    first = diff_bytes(data, data)
    second = diff_bytes(data, data)

    assert first == second
    assert first.changed_byte_count == 0
    assert first.ranges == []
    assert len(first.digest) == 64


def test_diff_rejects_length_change_for_ecu_binary_comparison():
    try:
        diff_bytes(b'\x00\x01', b'\x00\x01\x02')
    except ValueError as exc:
        assert str(exc) == 'ECU_BINARY_SIZE_MISMATCH'
    else:
        raise AssertionError('expected ECU_BINARY_SIZE_MISMATCH')
