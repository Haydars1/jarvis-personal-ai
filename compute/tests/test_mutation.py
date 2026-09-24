from ecu_worker.mutation import apply_exact_patches, apply_stage1_mutation
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


def test_exact_patch_mutation_requires_matching_original_bytes():
    ori=bytes.fromhex("0011223344556677")
    patches=[{"offset":2,"beforeHex":"2233","afterHex":"aabb"}]
    result=apply_exact_patches(ori,patches)
    assert result.data==bytes.fromhex("0011aabb44556677")
    assert result.allowed_ranges==[(2,4)]
    assert result.changes[0].changed_cells==2

    try:
        apply_exact_patches(bytes.fromhex("0011229944556677"),patches)
    except ValueError as exc:
        assert str(exc)=="PATCH_PRECONDITION_MISMATCH:2"
    else:
        raise AssertionError("mismatched ORI accepted")


def test_exact_patch_mutation_rejects_overlap():
    ori=bytes.fromhex("0011223344556677")
    patches=[
        {"offset":1,"beforeHex":"1122","afterHex":"aabb"},
        {"offset":2,"beforeHex":"2233","afterHex":"ccdd"},
    ]
    try:
        apply_exact_patches(ori,patches)
    except ValueError as exc:
        assert str(exc)=="PATCH_RULES_OVERLAP"
    else:
        raise AssertionError("overlapping patches accepted")


def test_exact_patch_relocates_with_unique_context_anchor():
    ori=b"AAAA"+bytes.fromhex("10200102aabbcc")+b"BBBB"
    patches=[{
        "offset":5,
        "beforeHex":"0102",
        "afterHex":"0908",
        "contextBeforeHex":"1020",
        "contextAfterHex":"aabbcc",
    }]
    result=apply_exact_patches(ori,patches,relocation_window=32)
    actual=6
    assert result.data[actual:actual+2]==bytes.fromhex("0908")
    assert result.allowed_ranges==[(actual,actual+2)]


def test_exact_patch_rejects_ambiguous_context_anchor():
    anchor=bytes.fromhex("10200102aabb")
    ori=b"AA"+anchor+b"XX"+anchor+b"ZZ"
    patches=[{
        "offset":0,
        "beforeHex":"0102",
        "afterHex":"0908",
        "contextBeforeHex":"1020",
        "contextAfterHex":"aabb",
    }]
    try:
        apply_exact_patches(ori,patches,relocation_window=64)
    except ValueError as exc:
        assert str(exc)=="PATCH_CONTEXT_AMBIGUOUS:0"
    else:
        raise AssertionError("ambiguous contextual patch accepted")
