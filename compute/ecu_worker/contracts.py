from __future__ import annotations

from hashlib import sha256
import json
from typing import Any, Literal

from pydantic import BaseModel, Field


SHA256_PATTERN = r'^[0-9a-fA-F]{64}$'


class AnalysisJobInput(BaseModel):
    job_id: str = Field(min_length=1)
    artifact_sha256: str = Field(min_length=64, max_length=64, pattern=SHA256_PATTERN)
    artifact_uri: str = Field(min_length=1)
    operation: Literal['analyze', 'stage1_proposal', 'dtc_off_proposal', 'egr_off_proposal', 'dpf_off_proposal', 'adblue_off_proposal', 'vmax_off_proposal', 'startstop_off_proposal'] = 'analyze'
    model_version: str = Field(default='baseline', min_length=1)
    rulepack_version: str = Field(default='baseline', min_length=1)
    paid_api_allowed: bool = False
    config: dict[str, Any] = Field(default_factory=dict)


class AnalysisJobOutput(BaseModel):
    job_id: str = Field(min_length=1)
    run_fingerprint: str = Field(min_length=64, max_length=64, pattern=SHA256_PATTERN)
    status: Literal['NEEDS_REVIEW', 'READY', 'FAILED'] = 'NEEDS_REVIEW'
    ecu_family: str = 'UNKNOWN'
    hw_candidates: list[dict[str, Any]] = Field(default_factory=list)
    sw_candidates: list[dict[str, Any]] = Field(default_factory=list)
    supported: bool = False
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, allow_inf_nan=False)
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    map_candidates: list[dict[str, Any]] = Field(default_factory=list)
    proposal: dict[str, Any] | None = None
    error: str | None = None


def build_run_fingerprint(
    artifact_sha256: str,
    model_version: str,
    rulepack_version: str,
    config: dict[str, Any] | None = None,
    *,
    operation: str = "analyze",
) -> str:
    canonical = json.dumps(
        {
            'artifact_sha256': artifact_sha256,
            'operation': operation,
            'model_version': model_version,
            'rulepack_version': rulepack_version,
            'config': config or {},
        },
        sort_keys=True,
        separators=(',', ':'),
        ensure_ascii=True,
    ).encode('utf-8')
    return sha256(canonical).hexdigest()


class TrainingJobInput(BaseModel):
    job_id: str = Field(min_length=1)
    operation: Literal['train'] = 'train'
    dataset_version: str = Field(min_length=1)
    dataset_digest: str = Field(min_length=64, max_length=64, pattern=SHA256_PATTERN)
    production_model_version: str = Field(default='baseline', min_length=1)
    paid_api_allowed: bool = False
    config: dict[str, Any] = Field(default_factory=dict)


class PairJobInput(BaseModel):
    job_id: str = Field(min_length=1)
    operation: Literal['diff_pair'] = 'diff_pair'
    ori_artifact_sha256: str = Field(min_length=64, max_length=64, pattern=SHA256_PATTERN)
    mod_artifact_sha256: str = Field(min_length=64, max_length=64, pattern=SHA256_PATTERN)
    ori_artifact_uri: str = Field(min_length=1)
    mod_artifact_uri: str = Field(min_length=1)
    operation_label: str = Field(min_length=1)
    paid_api_allowed: bool = False
    config: dict[str, Any] = Field(default_factory=dict)
