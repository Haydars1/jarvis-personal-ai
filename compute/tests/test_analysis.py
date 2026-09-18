from ecu_worker.analysis import analyze_binary
from ecu_worker.contracts import AnalysisJobInput


def test_analyze_binary_combines_fingerprint_and_map_candidates():
    marker = b"BOSCH EDC17C46 HW:0281012345 SW:1037512345\x00"
    # A smooth synthetic 8x8 u16 table gives the map scanner deterministic structure.
    table = b"".join((100 + r * 20 + c * 3).to_bytes(2, "big") for r in range(8) for c in range(8))
    data = marker + (b"\x00" * 32) + table
    job = AnalysisJobInput(
        job_id="job-1",
        artifact_sha256="a" * 64,
        artifact_uri="r2://ecu-artifacts/originals/" + "a" * 64,
    )

    result = analyze_binary(job, data)

    assert result.job_id == "job-1"
    assert result.ecu_family == "EDC17C46"
    assert result.supported is True
    assert result.confidence >= 0.9
    assert result.status == "NEEDS_REVIEW"
    assert result.map_candidates
    assert result.map_candidates[0]["offset"] >= len(marker)


def test_analyze_binary_never_claims_ready_for_unknown_binary():
    job = AnalysisJobInput(
        job_id="job-unknown",
        artifact_sha256="b" * 64,
        artifact_uri="r2://ecu-artifacts/originals/" + "b" * 64,
    )
    result = analyze_binary(job, bytes(range(64)) * 8)

    assert result.ecu_family == "UNKNOWN"
    assert result.supported is False
    assert result.status == "NEEDS_REVIEW"
    assert result.confidence == 0.0


def test_analyze_binary_applies_verified_semantic_model_when_supplied():
    from ecu_worker.training.dataset import TrainingExample
    from ecu_worker.training.semantic_model import dump_semantic_model, fit_semantic_model

    def row(label, span):
        return TrainingExample(
            ecu_family="EDC17C46",
            hw="HW-A",
            sw="SW-A",
            artifact_sha256=("c" if label == "torque_limiter" else "d") * 64,
            map_offset=100,
            semantic_label=label,
            source_type="verified_reference",
            source_confidence=1.0,
            human_verified=True,
            map_features={"rows": 8, "cols": 8, "span": span, "unique_ratio": 1.0, "smoothness": .8, "score": .95},
        )

    model = fit_semantic_model([
        row("torque_limiter", 180),
        row("torque_limiter", 190),
        row("boost_target", 1200),
        row("boost_target", 1220),
    ])

    marker = b"BOSCH EDC17C46\x00"
    table = b"".join((100 + r * 20 + c * 3).to_bytes(2, "big") for r in range(8) for c in range(8))
    data = marker + (b"\x00" * 32) + table
    job = AnalysisJobInput(
        job_id="job-semantic",
        artifact_sha256="e" * 64,
        artifact_uri="r2://ecu-artifacts/originals/" + "e" * 64,
        config={"semantic_model_json": dump_semantic_model(model)},
    )

    result = analyze_binary(job, data)

    assert result.map_candidates
    assert "semantic_label" in result.map_candidates[0]
    assert "semantic_confidence" in result.map_candidates[0]


def test_stage1_proposal_remains_blocked_without_verified_rulepack():
    marker=b"BOSCH EDC17C46\x00"
    table=b"".join((100+r*20+c*3).to_bytes(2,"big") for r in range(8) for c in range(8))
    data=marker+(b"\x00"*32)+table
    job=AnalysisJobInput(
        job_id="job-stage1",
        artifact_sha256="f"*64,
        artifact_uri="r2://ecu-artifacts/originals/"+"f"*64,
        operation="stage1_proposal",
        config={"rulepack_verified":False},
    )
    result=analyze_binary(job,data)
    assert result.status=="NEEDS_REVIEW"
    assert result.proposal is not None
    assert result.proposal["blocked"] is True
    assert "RULEPACK_UNVERIFIED" in result.proposal["reasons"]
    assert result.proposal["checksum_support"]=="UNSUPPORTED"
    assert result.proposal["release_ready"] is False
