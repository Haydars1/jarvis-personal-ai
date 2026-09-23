import pytest
from pydantic import ValidationError

from ecu_worker.contracts import AnalysisJobInput, AnalysisJobOutput, PairJobInput, TrainingJobInput, build_run_fingerprint


def test_run_fingerprint_is_deterministic_and_sensitive():
    a = build_run_fingerprint('abc', 'model-1', 'rules-1', {'mode': 'analyze', 'x': 1})
    b = build_run_fingerprint('abc', 'model-1', 'rules-1', {'x': 1, 'mode': 'analyze'})
    c = build_run_fingerprint('abc', 'model-2', 'rules-1', {'mode': 'analyze', 'x': 1})
    assert a == b
    assert a != c
    assert len(a) == 64


def test_analysis_job_input_defaults_to_safe_analysis():
    job = AnalysisJobInput(job_id='j1', artifact_sha256='a' * 64, artifact_uri='r2://bucket/originals/x')
    assert job.operation == 'analyze'
    assert job.paid_api_allowed is False


def test_hash_contracts_reject_non_hex_digests():
    with pytest.raises(ValidationError):
        AnalysisJobInput(job_id='j1', artifact_sha256='z' * 64, artifact_uri='r2://bucket/originals/x')
    with pytest.raises(ValidationError):
        TrainingJobInput(job_id='j2', dataset_version='d1', dataset_digest='g' * 64)
    with pytest.raises(ValidationError):
        PairJobInput(
            job_id='j3',
            ori_artifact_sha256='a' * 64,
            mod_artifact_sha256='x' * 64,
            ori_artifact_uri='r2://bucket/originals/a',
            mod_artifact_uri='r2://bucket/mods/b',
            operation_label='stage1',
        )


def test_output_has_explicit_unknown_support_state():
    output = AnalysisJobOutput(job_id='j1', run_fingerprint='b' * 64)
    assert output.status == 'NEEDS_REVIEW'
    assert output.ecu_family == 'UNKNOWN'
    assert output.supported is False


def test_run_fingerprint_changes_when_operation_changes():
    analyze = build_run_fingerprint('abc', 'model-1', 'rules-1', {'x': 1}, operation='analyze')
    stage1 = build_run_fingerprint('abc', 'model-1', 'rules-1', {'x': 1}, operation='stage1_proposal')
    assert analyze != stage1
