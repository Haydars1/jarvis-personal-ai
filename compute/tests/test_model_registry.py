from ecu_worker.training.registry import ModelRegistry, ModelVersion


def model(version: str, score: float) -> ModelVersion:
    return ModelVersion(
        version=version,
        dataset_version='dataset-1',
        benchmark_score=score,
        artifact_uri=f'models/{version}',
    )


def test_worse_candidate_cannot_replace_production():
    registry = ModelRegistry(production=model('v1', 0.91))
    result = registry.promote_if_better(model('v2', 0.88))

    assert result.promoted is False
    assert result.reason == 'BENCHMARK_NOT_BETTER'
    assert registry.production.version == 'v1'


def test_better_candidate_is_promoted_and_previous_version_is_kept_for_rollback():
    registry = ModelRegistry(production=model('v1', 0.91))
    result = registry.promote_if_better(model('v2', 0.94))

    assert result.promoted is True
    assert registry.production.version == 'v2'
    assert registry.rollback_target.version == 'v1'

    rolled_back = registry.rollback()
    assert rolled_back.version == 'v1'
    assert registry.production.version == 'v1'


def test_equal_score_is_not_enough_to_promote():
    registry = ModelRegistry(production=model('v1', 0.91))
    result = registry.promote_if_better(model('v2', 0.91))

    assert result.promoted is False
    assert registry.production.version == 'v1'
