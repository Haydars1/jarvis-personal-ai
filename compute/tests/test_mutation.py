from ecu_worker.mutation import apply_stage1_mutation
from ecu_worker.proposal import ProposalItem, Stage1Proposal


def test_verified_stage1_mutation_changes_only_declared_map_range():
    ori=bytes.fromhex("000a0014001e00280032003c")
    proposal=Stage1Proposal(items=[ProposalItem(
        semantic_label="TORQUE_LIMITER",offset=2,rows=1,cols=2,
        max_delta_percent=10.0,target_delta_percent=10.0,
        confidence=0.99,data_type="u16",endian="big",
    )])
    result=apply_stage1_mutation(ori,proposal)
    assert result.data[:2]==ori[:2]
    assert result.data[6:]==ori[6:]
    assert int.from_bytes(result.data[2:4],"big")==22
    assert int.from_bytes(result.data[4:6],"big")==33
    assert result.allowed_ranges==[(2,6)]


def test_blocked_proposal_never_mutates():
    proposal=Stage1Proposal(blocked=True,reasons=["RULEPACK_UNVERIFIED"])
    try:
        apply_stage1_mutation(b"\x00\x01",proposal)
    except ValueError as exc:
        assert str(exc)=="STAGE1_PROPOSAL_BLOCKED"
    else:
        raise AssertionError("blocked proposal mutated bytes")
