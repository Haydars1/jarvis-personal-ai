from ecu_worker.diff import diff_bytes, link_ranges_to_maps


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


def test_diff_map_link_preserves_human_verification_evidence():
    ori=bytes([0])*16
    mod=bytearray(ori);mod[4]=1
    report=diff_bytes(ori,bytes(mod))
    linked=link_ranges_to_maps(report,[{
        "offset":4,"rows":1,"cols":1,"data_type":"u16",
        "semantic_label":"torque_limiter","semantic_confidence":1.0,
        "human_verified":True,
    }])
    assert linked[0]["map_hits"][0]["human_verified"] is True


def test_diff_measures_verified_u16_map_percent_deltas():
    from ecu_worker.diff import measure_verified_map_deltas
    ori=bytearray(16)
    mod=bytearray(16)
    values=[100,200,300,400]
    changed=[110,220,300,360]
    for i,value in enumerate(values):
        ori[4+i*2:6+i*2]=value.to_bytes(2,"big")
    for i,value in enumerate(changed):
        mod[4+i*2:6+i*2]=value.to_bytes(2,"big")
    maps=[{
        "offset":4,"rows":1,"cols":4,"data_type":"u16","endian":"big",
        "semantic_label":"torque_limiter","semantic_confidence":1.0,"human_verified":True,
    }]
    rows=measure_verified_map_deltas(bytes(ori),bytes(mod),maps)
    assert len(rows)==1
    row=rows[0]
    assert row["semantic_label"]=="torque_limiter"
    assert row["changed_cells"]==3
    assert round(row["max_abs_percent"],2)==10.0
    assert round(row["mean_abs_percent"],2)==10.0


def test_delta_measurement_ignores_unverified_or_unknown_maps():
    from ecu_worker.diff import measure_verified_map_deltas
    data=bytes([0])*16
    assert measure_verified_map_deltas(data,data,[{
        "offset":0,"rows":1,"cols":2,"data_type":"u16","endian":"big",
        "semantic_label":"UNKNOWN","human_verified":True,
    }])==[]
    assert measure_verified_map_deltas(data,data,[{
        "offset":0,"rows":1,"cols":2,"data_type":"u16","endian":"big",
        "semantic_label":"boost_target","human_verified":False,
    }])==[]
