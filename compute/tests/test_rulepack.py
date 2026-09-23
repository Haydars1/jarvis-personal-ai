from ecu_worker.training.rulepack import build_rulepack_candidate


def test_rulepack_candidate_requires_repeated_verified_pair_evidence():
    rows=[
        {"pair_id":f"p{i}","operation_label":"stage1","semantic_label":"torque_limiter",
         "human_verified":True,"delta_stats":{"p95AbsPercent":5+i*.1}}
        for i in range(5)
    ]
    candidate=build_rulepack_candidate(rows,min_pairs_per_label=5)
    assert candidate.state=="EVIDENCE_CANDIDATE"
    assert candidate.verified is False
    assert candidate.rules["torque_limiter"]["evidence_pairs"]==5
    assert 5.0 <= candidate.rules["torque_limiter"]["observed_envelope_percent"] <= 5.5


def test_rulepack_candidate_ignores_unverified_and_insufficient_labels():
    rows=[
        {"pair_id":"p1","operation_label":"stage1","semantic_label":"boost_target",
         "human_verified":False,"delta_stats":{"p95AbsPercent":4.0}},
        {"pair_id":"p2","operation_label":"stage1","semantic_label":"boost_target",
         "human_verified":True,"delta_stats":{"p95AbsPercent":4.0}},
    ]
    candidate=build_rulepack_candidate(rows,min_pairs_per_label=3)
    assert candidate.rules=={}
    assert candidate.ready_for_benchmark is False


def test_rulepack_candidate_never_turns_observed_envelope_into_verified_modify_rule():
    rows=[
        {"pair_id":f"p{i}","operation_label":"stage1","semantic_label":"boost_target",
         "human_verified":True,"delta_stats":{"p95AbsPercent":7.0}}
        for i in range(6)
    ]
    candidate=build_rulepack_candidate(rows,min_pairs_per_label=5)
    rule=candidate.rules["boost_target"]
    assert "max_delta_percent" not in rule
    assert rule["observed_envelope_percent"]==7.0
    assert candidate.verified is False
