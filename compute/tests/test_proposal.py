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


def test_stage1_rulepack_must_be_explicitly_verified():
    from ecu_worker.proposal import stage1_proposal_from_config
    maps=[{"offset":100,"rows":8,"cols":8,"semantic_label":"torque_limiter","semantic_confidence":.99}]
    result=stage1_proposal_from_config(maps,{
        "rulepack_verified":False,
        "rulepack":{"torque_limiter":{"max_delta_percent":8}},
    })
    assert result.blocked is True
    assert "RULEPACK_UNVERIFIED" in result.reasons
    assert result.items == []


def test_verified_rulepack_builds_bounded_stage1_proposal_without_modifying_bytes():
    from ecu_worker.proposal import stage1_proposal_from_config
    maps=[
        {"offset":100,"rows":8,"cols":8,"semantic_label":"torque_limiter","semantic_confidence":.99},
        {"offset":300,"rows":8,"cols":8,"semantic_label":"boost_target","semantic_confidence":.97},
    ]
    result=stage1_proposal_from_config(maps,{
        "rulepack_verified":True,
        "required_labels":["torque_limiter","boost_target"],
        "rulepack":{
            "torque_limiter":{"max_delta_percent":8},
            "boost_target":{"max_delta_percent":5},
        },
    })
    assert result.blocked is False
    assert [x.max_delta_percent for x in result.items]==[8.0,5.0]
    assert result.requires_checksum is True


def test_stage1_proposal_rejects_non_finite_or_malformed_confidence():
    maps=[
        {"offset":100,"semantic_label":"torque_limiter","semantic_confidence":float("nan")},
        {"offset":200,"semantic_label":"torque_limiter","semantic_confidence":float("inf")},
        {"offset":300,"semantic_label":"torque_limiter","semantic_confidence":"not-a-number"},
    ]
    rules={"torque_limiter": CalibrationRule(label="torque_limiter", max_delta_percent=8.0)}
    proposal=propose_stage1(maps,rules,min_confidence=.9)
    assert proposal.items == []
    assert proposal.unknown_maps == 3


def test_verified_rulepack_rejects_non_finite_delta():
    from ecu_worker.proposal import stage1_proposal_from_config
    maps=[{"offset":100,"semantic_label":"torque_limiter","semantic_confidence":.99}]
    result=stage1_proposal_from_config(maps,{
        "rulepack_verified":True,
        "required_labels":["torque_limiter"],
        "rulepack":{"torque_limiter":{"max_delta_percent":"nan"}},
    })
    assert result.items == []
    assert result.blocked is True
    assert "MISSING_REQUIRED_MAP:torque_limiter" in result.reasons
