from ecu_worker.proposal import CalibrationRule, propose_stage1


def test_stage1_proposal_only_uses_verified_semantic_maps_and_rulepack():
    maps=[
        {"offset":100,"rows":8,"cols":8,"data_type":"u16","semantic_label":"torque_limiter","semantic_confidence":0.96},
        {"offset":300,"rows":8,"cols":8,"data_type":"u16","semantic_label":"boost_target","semantic_confidence":0.93},
        {"offset":500,"rows":8,"cols":8,"data_type":"u16","semantic_label":"UNKNOWN","semantic_confidence":0.0},
    ]
    rules={
        "torque_limiter": CalibrationRule(label="torque_limiter", max_delta_percent=8.0),
        "boost_target": CalibrationRule(label="boost_target", max_delta_percent=5.0),
    }
    proposal=propose_stage1(maps,rules,min_confidence=0.90)

    assert [item.semantic_label for item in proposal.items] == ["torque_limiter","boost_target"]
    assert proposal.blocked is False
    assert proposal.unknown_maps == 1
    assert proposal.requires_checksum is True


def test_stage1_proposal_blocks_when_required_semantics_are_missing():
    maps=[{"offset":100,"rows":8,"cols":8,"data_type":"u16","semantic_label":"torque_limiter","semantic_confidence":0.96}]
    rules={"torque_limiter": CalibrationRule(label="torque_limiter", max_delta_percent=8.0)}
    proposal=propose_stage1(maps,rules,required_labels={"torque_limiter","boost_target"})
    assert proposal.blocked is True
    assert "MISSING_REQUIRED_MAP:boost_target" in proposal.reasons


def test_stage1_proposal_never_modifies_unknown_or_low_confidence_maps():
    maps=[
        {"offset":100,"rows":8,"cols":8,"data_type":"u16","semantic_label":"torque_limiter","semantic_confidence":0.4},
        {"offset":300,"rows":8,"cols":8,"data_type":"u16","semantic_label":"UNKNOWN","semantic_confidence":0.99},
    ]
    rules={"torque_limiter": CalibrationRule(label="torque_limiter", max_delta_percent=8.0)}
    proposal=propose_stage1(maps,rules,min_confidence=0.9)
    assert proposal.items == []
    assert proposal.unknown_maps == 2
