from __future__ import annotations

from .contracts import AnalysisJobInput, AnalysisJobOutput, build_run_fingerprint
from .fingerprint import fingerprint_binary
from .maps import extract_map_candidates
from .training.semantic_model import load_semantic_model, predict_semantic


def analyze_binary(job: AnalysisJobInput, data: bytes) -> AnalysisJobOutput:
    fp = fingerprint_binary(data)
    maps = extract_map_candidates(data)
    evidence = [{"kind": "fingerprint", "text": item} for item in fp.evidence]
    semantic_model = None
    raw_model = job.config.get("semantic_model_json")
    if raw_model:
        try:
            semantic_model = load_semantic_model(raw_model)
        except Exception:
            semantic_model = None

    map_candidates = []
    for item in maps:
        features = {
            "rows": float(item.rows),
            "cols": float(item.cols),
            "span": float(item.max_value - item.min_value),
            "unique_ratio": float(item.unique_ratio),
            "smoothness": float(item.smoothness),
            "score": float(item.score),
        }
        semantic = predict_semantic(semantic_model, features) if semantic_model is not None else None
        map_candidates.append({
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
            "semantic_label": semantic.label if semantic is not None else "UNKNOWN",
            "semantic_confidence": semantic.confidence if semantic is not None else 0.0,
            "needs_review": semantic.needs_review if semantic is not None else True,
        })
    return AnalysisJobOutput(
        job_id=job.job_id,
        run_fingerprint=build_run_fingerprint(
            job.artifact_sha256,
            job.model_version,
            job.rulepack_version,
            job.config,
            operation=job.operation,
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
