from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BenchmarkMetrics:
    accuracy: float
    macro_f1: float
    unknown_precision: float
    calibration_error: float


@dataclass(frozen=True)
class BenchmarkComparison:
    promotable: bool
    reason: str
    production_score: float
    candidate_score: float


def _bounded(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def composite_score(metrics: BenchmarkMetrics) -> float:
    calibration_quality = 1.0 - _bounded(metrics.calibration_error)
    score = (
        0.35 * _bounded(metrics.accuracy)
        + 0.35 * _bounded(metrics.macro_f1)
        + 0.20 * _bounded(metrics.unknown_precision)
        + 0.10 * calibration_quality
    )
    return _bounded(score)


def compare_candidate(
    production: BenchmarkMetrics,
    candidate: BenchmarkMetrics,
    *,
    safety_tolerance: float = 0.01,
    minimum_improvement: float = 1e-9,
) -> BenchmarkComparison:
    production_score = composite_score(production)
    candidate_score = composite_score(candidate)

    if candidate.unknown_precision + safety_tolerance < production.unknown_precision:
        return BenchmarkComparison(
            promotable=False,
            reason='SAFETY_METRIC_REGRESSION',
            production_score=production_score,
            candidate_score=candidate_score,
        )

    if candidate.calibration_error > production.calibration_error + safety_tolerance:
        return BenchmarkComparison(
            promotable=False,
            reason='SAFETY_METRIC_REGRESSION',
            production_score=production_score,
            candidate_score=candidate_score,
        )

    if candidate_score <= production_score + minimum_improvement:
        return BenchmarkComparison(
            promotable=False,
            reason='BENCHMARK_NOT_BETTER',
            production_score=production_score,
            candidate_score=candidate_score,
        )

    return BenchmarkComparison(
        promotable=True,
        reason='BENCHMARK_IMPROVED',
        production_score=production_score,
        candidate_score=candidate_score,
    )
