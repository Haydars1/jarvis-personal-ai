from __future__ import annotations

from .contracts import AnalysisJobInput, AnalysisJobOutput, build_run_fingerprint
from .fingerprint import fingerprint_binary
from .maps import extract_map_candidates


def analyze_binary(job: AnalysisJobInput, data: bytes) -> AnalysisJobOutput:
    fp = fingerprint_binary(data)
    maps = extract_map_candidates(data)
    evidence = [{"kind": "fingerprint", "text": item} for item in fp.evidence]
    map_candidates = [
        {
            "offset": item.offset,
            "rows": item.rows,
            "cols": item.cols,
            "data_type": "u16",
            "endian": item.endian,
            "min_value": item.min_value,
            "max_value": item.max_value,
            "unique_ratio": item.unique_ratio,
            "smoothness": item.smoothness,
            "score": item.score,
        }
        for item in maps
    ]
    return AnalysisJobOutput(
        job_id=job.job_id,
        run_fingerprint=build_run_fingerprint(
            job.artifact_sha256,
            job.model_version,
            job.rulepack_version,
            job.config,
        ),
        status="NEEDS_REVIEW",
        ecu_family=fp.ecu_family,
        hw_candidates=[{"value": value} for value in fp.hw_candidates],
        sw_candidates=[{"value": value} for value in fp.sw_candidates],
        supported=fp.supported,
        confidence=fp.confidence,
        evidence=evidence,
        map_candidates=map_candidates,
    )
