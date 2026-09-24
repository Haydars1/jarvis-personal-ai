from __future__ import annotations

from .contracts import AnalysisJobInput, AnalysisJobOutput, build_run_fingerprint
from .fingerprint import fingerprint_binary
from .maps import extract_map_candidates, extract_map_candidates_multiendian
from .map_heuristics import classify_map_heuristic
from .training.semantic_model import load_semantic_model, predict_semantic
from .proposal import stage1_proposal_from_config
from .mutation import apply_exact_patches, apply_stage1_mutation
from .release import build_release_decision
from .validation import ChecksumRegistry, ProfileChecksumAdapter


def checksum_adapter_from_config(job: AnalysisJobInput, ecu_family: str):
    registry_adapter=ChecksumRegistry().adapter_for(ecu_family)
    if registry_adapter.name!="unsupported":
        return registry_adapter
    profile=job.config.get("checksum_profile")
    if isinstance(profile,dict) and profile.get("algorithm"):
        return ProfileChecksumAdapter(profile)
    return registry_adapter


def analyze_binary_with_artifact(job: AnalysisJobInput, data: bytes) -> tuple[AnalysisJobOutput, bytes | None, str | None]:
    fp = fingerprint_binary(data)
    maps = extract_map_candidates_multiendian(data)
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
        heuristic = classify_map_heuristic(data,item,fp.ecu_family)
        semantic_label = semantic.label if semantic is not None else "UNKNOWN"
        semantic_confidence = semantic.confidence if semantic is not None else 0.0
        semantic_source = "model" if semantic is not None else "none"
        semantic_evidence: list[str] = []
        if heuristic.label != "UNKNOWN" and heuristic.confidence > semantic_confidence:
            semantic_label = heuristic.label
            semantic_confidence = heuristic.confidence
            semantic_source = "heuristic"
            semantic_evidence = list(heuristic.evidence)
        needs_review = semantic_label == "UNKNOWN" or semantic_confidence < 0.90
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
            "x_axis_offset": item.x_axis_offset,
            "y_axis_offset": item.y_axis_offset,
            "axis_score": item.axis_score,
            "source": item.source,
            "semantic_label": semantic_label,
            "semantic_confidence": semantic_confidence,
            "semantic_source": semantic_source,
            "semantic_evidence": semantic_evidence,
            "needs_review": needs_review,
        })
    proposal = None
    status = "NEEDS_REVIEW"
    mod_bytes = None
    checksum_algorithm = None
    if job.operation == "stage1_proposal":
        stage1 = stage1_proposal_from_config(map_candidates, job.config)
        checksum_adapter=checksum_adapter_from_config(job,fp.ecu_family)
        mutation=None
        release=None
        mutation_error=None
        if not stage1.blocked and stage1.items:
            try:
                mutation=apply_stage1_mutation(data,stage1)
                release=build_release_decision(
                    data,
                    mutation.data,
                    allowed_ranges=mutation.allowed_ranges,
                    checksum_adapter=checksum_adapter,
                )
                if release.ready:
                    status="READY"
                    mod_bytes=release.mod_bytes
                    checksum_algorithm=release.checksum_algorithm
            except ValueError as exc:
                mutation_error=str(exc)
        checksum_probe=(release.mod_bytes if release and release.mod_bytes is not None else (mutation.data if mutation else data))
        checksum_support=checksum_adapter.verify(checksum_probe)
        proposal = {
            "blocked": stage1.blocked,
            "reasons": stage1.reasons + ([mutation_error] if mutation_error else []),
            "unknown_maps": stage1.unknown_maps,
            "requires_checksum": stage1.requires_checksum,
            "checksum_support": checksum_support.status,
            "release_ready": bool(release.ready) if release else False,
            "validation": {
                "ready": bool(release.ready) if release else False,
                "errors": list(release.errors) if release else ([mutation_error] if mutation_error else []),
                "checksum": {
                    "status": checksum_support.status,
                    "algorithm": checksum_support.algorithm,
                    "verified": checksum_support.verified,
                },
            },
            "mutation": {
                "changed_maps": len(mutation.changes) if mutation else 0,
                "changed_cells": sum(change.changed_cells for change in mutation.changes) if mutation else 0,
                "changes": [
                    {
                        "semantic_label": change.semantic_label,
                        "offset": change.offset,
                        "changed_cells": change.changed_cells,
                        "target_delta_percent": change.target_delta_percent,
                    }
                    for change in (mutation.changes if mutation else [])
                ],
            },
            "items": [
                {
                    "semantic_label": item.semantic_label,
                    "offset": item.offset,
                    "rows": item.rows,
                    "cols": item.cols,
                    "max_delta_percent": item.max_delta_percent,
                    "target_delta_percent": item.target_delta_percent,
                    "confidence": item.confidence,
                    "data_type": item.data_type,
                    "endian": item.endian,
                }
                for item in stage1.items
            ],
        }

    elif job.operation != "analyze":
        checksum_adapter=checksum_adapter_from_config(job,fp.ecu_family)
        raw_rules=job.config.get("rulepack") or {}
        patches=raw_rules.get("__patches") if isinstance(raw_rules,dict) else None
        mutation=None
        release=None
        mutation_error=None
        reasons=[]
        if not bool(job.config.get("rulepack_verified")):
            reasons.append("RULEPACK_UNVERIFIED")
        elif not isinstance(patches,list) or not patches:
            reasons.append("PATCH_RULEPACK_MISSING")
        else:
            try:
                mutation=apply_exact_patches(data,patches)
                release=build_release_decision(
                    data,
                    mutation.data,
                    allowed_ranges=mutation.allowed_ranges,
                    checksum_adapter=checksum_adapter,
                )
                if release.ready:
                    status="READY"
                    mod_bytes=release.mod_bytes
                    checksum_algorithm=release.checksum_algorithm
            except ValueError as exc:
                mutation_error=str(exc)
                reasons.append(mutation_error)
        checksum_support=checksum_adapter.verify(mutation.data if mutation else data)
        proposal={
            "operation":job.operation,
            "operation_label":str(job.config.get("operation_label") or ""),
            "blocked":bool(reasons),
            "reasons":reasons,
            "requires_checksum":True,
            "checksum_support":checksum_support.status,
            "release_ready":bool(release.ready) if release else False,
            "validation":{
                "ready":bool(release.ready) if release else False,
                "errors":list(release.errors) if release else reasons,
                "checksum":{
                    "status":checksum_support.status,
                    "algorithm":checksum_support.algorithm,
                    "verified":checksum_support.verified,
                },
            },
            "mutation":{
                "changed_maps":0,
                "changed_cells":sum(change.changed_cells for change in mutation.changes) if mutation else 0,
                "patch_count":len(mutation.changes) if mutation else 0,
                "changes":[
                    {
                        "semantic_label":change.semantic_label,
                        "offset":change.offset,
                        "changed_cells":change.changed_cells,
                    }
                    for change in (mutation.changes if mutation else [])
                ],
            },
        }

    output=AnalysisJobOutput(
        job_id=job.job_id,
        run_fingerprint=build_run_fingerprint(
            job.artifact_sha256,
            job.model_version,
            job.rulepack_version,
            job.config,
            operation=job.operation,
        ),
        status=status,
        ecu_family=fp.ecu_family,
        hw_candidates=[{"value": value} for value in fp.hw_candidates],
        sw_candidates=[{"value": value} for value in fp.sw_candidates],
        supported=fp.supported,
        confidence=fp.confidence,
        evidence=evidence,
        map_candidates=map_candidates,
        proposal=proposal,
    )
    return output, mod_bytes, checksum_algorithm


def analyze_binary(job: AnalysisJobInput, data: bytes) -> AnalysisJobOutput:
    output, _, _ = analyze_binary_with_artifact(job, data)
    return output
