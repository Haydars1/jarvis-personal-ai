from __future__ import annotations

from hashlib import sha256
import json
from typing import Any, Literal

from pydantic import BaseModel, Field


class AnalysisJobInput(BaseModel):
    job_id: str
    artifact_sha256: str = Field(min_length=64, max_length=64)
    artifact_uri: str
    operation: str = 'analyze'
    model_version: str = 'baseline'
    rulepack_version: str = 'baseline'
    paid_api_allowed: bool = False
    config: dict[str, Any] = Field(default_factory=dict)


class AnalysisJobOutput(BaseModel):
    job_id: str
    run_fingerprint: str = Field(min_length=64, max_length=64)
    status: Literal['NEEDS_REVIEW', 'READY', 'FAILED'] = 'NEEDS_REVIEW'
    ecu_family: str = 'UNKNOWN'
    hw_candidates: list[dict[str, Any]] = Field(default_factory=list)
    sw_candidates: list[dict[str, Any]] = Field(default_factory=list)
    supported: bool = False
    confidence: float = 0.0
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    map_candidates: list[dict[str, Any]] = Field(default_factory=list)
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
    job_id: str
    operation: Literal['train'] = 'train'
    dataset_version: str
    dataset_digest: str = Field(min_length=64, max_length=64)
    production_model_version: str = 'baseline'
    paid_api_allowed: bool = False
    config: dict[str, Any] = Field(default_factory=dict)


class PairJobInput(BaseModel):
    job_id: str
    operation: Literal['diff_pair'] = 'diff_pair'
    ori_artifact_sha256: str = Field(min_length=64, max_length=64)
    mod_artifact_sha256: str = Field(min_length=64, max_length=64)
    ori_artifact_uri: str
    mod_artifact_uri: str
    operation_label: str
    paid_api_allowed: bool = False
    config: dict[str, Any] = Field(default_factory=dict)
