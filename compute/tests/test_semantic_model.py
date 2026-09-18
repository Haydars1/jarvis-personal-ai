from ecu_worker.training.semantic_model import fit_semantic_model, predict_semantic
from ecu_worker.training.dataset import TrainingExample


def ex(label: str, features: dict[str, float]) -> TrainingExample:
    return TrainingExample(
        ecu_family="EDC17C46",
        hw="HW-A",
        sw="SW-A",
        artifact_sha256=("a" if label == "torque_limiter" else "b") * 64,
        map_offset=4096,
        semantic_label=label,
        source_type="verified_reference",
        source_confidence=1.0,
        human_verified=True,
        map_features=features,
    )


def test_semantic_model_learns_from_verified_feature_centroids():
    rows = [
        ex("torque_limiter", {"rows": 16, "cols": 16, "span": 400, "unique_ratio": .8, "smoothness": .9, "score": .95}),
        ex("torque_limiter", {"rows": 16, "cols": 16, "span": 420, "unique_ratio": .82, "smoothness": .88, "score": .93}),
        ex("boost_target", {"rows": 12, "cols": 12, "span": 1200, "unique_ratio": .7, "smoothness": .75, "score": .9}),
        ex("boost_target", {"rows": 12, "cols": 12, "span": 1180, "unique_ratio": .72, "smoothness": .77, "score": .91}),
    ]
    model = fit_semantic_model(rows)
    prediction = predict_semantic(model, {"rows": 16, "cols": 16, "span": 410, "unique_ratio": .81, "smoothness": .89, "score": .94})

    assert prediction.label == "torque_limiter"
    assert prediction.confidence > 0.7
    assert prediction.needs_review is False


def test_semantic_model_returns_unknown_for_far_out_feature_vector():
    rows = [
        ex("torque_limiter", {"rows": 16, "cols": 16, "span": 400, "unique_ratio": .8, "smoothness": .9, "score": .95}),
        ex("torque_limiter", {"rows": 16, "cols": 16, "span": 420, "unique_ratio": .82, "smoothness": .88, "score": .93}),
    ]
    model = fit_semantic_model(rows)
    prediction = predict_semantic(model, {"rows": 4, "cols": 4, "span": 60000, "unique_ratio": .1, "smoothness": .05, "score": .4})

    assert prediction.label == "UNKNOWN"
    assert prediction.needs_review is True


def test_unverified_examples_never_train_semantic_model():
    row = ex("torque_limiter", {"rows": 16, "cols": 16, "span": 400, "unique_ratio": .8, "smoothness": .9, "score": .95})
    unverified = TrainingExample(**{**row.__dict__, "human_verified": False})
    model = fit_semantic_model([unverified])
    assert model.labels == {}


def test_semantic_model_serializes_deterministically_and_round_trips():
    from ecu_worker.training.semantic_model import dump_semantic_model, load_semantic_model
    rows = [
        ex("torque_limiter", {"rows": 16, "cols": 16, "span": 400, "unique_ratio": .8, "smoothness": .9, "score": .95}),
        ex("torque_limiter", {"rows": 16, "cols": 16, "span": 420, "unique_ratio": .82, "smoothness": .88, "score": .93}),
    ]
    model = fit_semantic_model(rows)
    first = dump_semantic_model(model)
    second = dump_semantic_model(model)
    assert first == second
    restored = load_semantic_model(first)
    assert restored == model
