from ecu_worker.rulepack_select import select_rulepack_for_binary


def candidate(version, tier, offset, before, after, context_before="", context_after=""):
    return {
        "version": version,
        "matchTier": tier,
        "portable": tier == "SAME_HW_CONTEXTUAL",
        "rules": {
            "__patches": [{
                "offset": offset,
                "length": len(bytes.fromhex(before)),
                "beforeHex": before,
                "afterHex": after,
                "contextBeforeHex": context_before,
                "contextAfterHex": context_after,
                "evidencePairs": 5,
            }]
        },
    }


def test_prefers_exact_sw_when_binary_precondition_matches():
    data=bytes.fromhex("001122334455")
    rows=[
        candidate("portable","SAME_HW_CONTEXTUAL",2,"22","aa","11","33"),
        candidate("exact","EXACT_SW",2,"22","bb","11","33"),
    ]
    result=select_rulepack_for_binary(data,rows,operation_label="egr_off")
    assert result.candidate["version"]=="exact"
    assert result.reason=="EXACT_RULEPACK_MATCH"


def test_chooses_unique_portable_contextual_output():
    data=bytes.fromhex("001122334455")
    rows=[
        candidate("p1","SAME_HW_CONTEXTUAL",2,"22","aa","11","33"),
        candidate("p2","SAME_HW_CONTEXTUAL",2,"99","bb","11","33"),
    ]
    result=select_rulepack_for_binary(data,rows,operation_label="egr_off")
    assert result.candidate["version"]=="p1"
    assert result.reason=="PORTABLE_CONTEXT_MATCH"
    assert result.compatible_count==1


def test_rejects_portable_candidates_that_produce_different_outputs():
    data=bytes.fromhex("001122334455")
    rows=[
        candidate("p1","SAME_HW_CONTEXTUAL",2,"22","aa","11","33"),
        candidate("p2","SAME_HW_CONTEXTUAL",2,"22","bb","11","33"),
    ]
    result=select_rulepack_for_binary(data,rows,operation_label="egr_off")
    assert result.candidate is None
    assert result.reason=="PORTABLE_RULEPACK_AMBIGUOUS"
    assert result.unique_outputs==2


def test_stage1_never_uses_cross_sw_portable_rulepack():
    rows=[{"version":"p","matchTier":"SAME_HW_CONTEXTUAL","rules":{"torque_limiter":{"targetDeltaPercent":5}}}]
    result=select_rulepack_for_binary(b"abc",rows,operation_label="stage1")
    assert result.candidate is None
    assert result.reason=="STAGE1_EXACT_RULEPACK_REQUIRED"
