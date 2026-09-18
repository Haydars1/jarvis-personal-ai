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
