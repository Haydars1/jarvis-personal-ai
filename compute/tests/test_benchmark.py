from ecu_worker.training.benchmark import BenchmarkMetrics, compare_candidate, composite_score


def test_composite_score_rewards_accuracy_f1_unknown_handling_and_calibration():
    strong = BenchmarkMetrics(accuracy=0.94, macro_f1=0.92, unknown_precision=0.90, calibration_error=0.04)
    weak = BenchmarkMetrics(accuracy=0.85, macro_f1=0.80, unknown_precision=0.70, calibration_error=0.18)

    assert composite_score(strong) > composite_score(weak)
    assert 0.0 <= composite_score(strong) <= 1.0


def test_candidate_must_improve_score_without_regressing_safety_metrics():
    production = BenchmarkMetrics(accuracy=0.90, macro_f1=0.89, unknown_precision=0.92, calibration_error=0.06)
    candidate = BenchmarkMetrics(accuracy=0.93, macro_f1=0.92, unknown_precision=0.93, calibration_error=0.05)

    result = compare_candidate(production, candidate)

    assert result.promotable is True
    assert result.reason == 'BENCHMARK_IMPROVED'


def test_candidate_with_better_average_but_worse_unknown_precision_is_rejected():
    production = BenchmarkMetrics(accuracy=0.90, macro_f1=0.88, unknown_precision=0.94, calibration_error=0.06)
    candidate = BenchmarkMetrics(accuracy=0.97, macro_f1=0.96, unknown_precision=0.80, calibration_error=0.03)

    result = compare_candidate(production, candidate)

    assert result.promotable is False
    assert result.reason == 'SAFETY_METRIC_REGRESSION'
