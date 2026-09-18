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


def test_diff_links_changed_ranges_to_overlapping_semantic_map_candidates():
    from ecu_worker.diff import link_ranges_to_maps
    ori=bytes([0])*64
    mod=bytearray(ori)
    mod[18]=1
    mod[19]=2
    mod[50]=3
    report=diff_bytes(ori,bytes(mod))
    maps=[
        {"offset":16,"rows":2,"cols":4,"data_type":"u16","semantic_label":"torque_limiter","semantic_confidence":0.96},
        {"offset":32,"rows":2,"cols":4,"data_type":"u16","semantic_label":"boost_target","semantic_confidence":0.91},
    ]

    linked=link_ranges_to_maps(report,maps)

    assert linked[0]["start"]==18
    assert linked[0]["map_hits"][0]["semantic_label"]=="torque_limiter"
    assert linked[0]["map_hits"][0]["overlap_bytes"]==2
    assert linked[1]["start"]==50
    assert linked[1]["map_hits"]==[]
