from ecu_worker.training.dataset import TrainingExample, build_snapshot


def example(sw: str, verified: bool = True, label: str = 'torque_limiter') -> TrainingExample:
    return TrainingExample(
        ecu_family='EDC17C46',
        hw='HW-A',
        sw=sw,
        artifact_sha256=(sw.encode().hex() + '0' * 64)[:64],
        map_offset=4096,
        semantic_label=label,
        source_type='ori_mod_pair',
        source_confidence=0.95,
        human_verified=verified,
    )


def test_gold_snapshot_excludes_unverified_examples():
    snapshot = build_snapshot([
        example('SW-1', verified=True),
        example('SW-2', verified=False),
    ], version='dataset-1')

    assert snapshot.version == 'dataset-1'
    assert len(snapshot.examples) == 1
    assert snapshot.examples[0].sw == 'SW-1'
    assert len(snapshot.digest) == 64


def test_split_keeps_same_sw_group_in_only_one_partition():
    snapshot = build_snapshot([
        example('SW-1'),
        example('SW-1', label='boost_target'),
        example('SW-2'),
        example('SW-3'),
        example('SW-4'),
        example('SW-5'),
    ], version='dataset-2')

    memberships = {}
    for name, rows in snapshot.splits.items():
        for row in rows:
            key = (row.ecu_family, row.hw, row.sw)
            memberships.setdefault(key, set()).add(name)

    assert memberships
    assert all(len(parts) == 1 for parts in memberships.values())


def test_snapshot_is_deterministic_for_same_verified_examples():
    rows = [example('SW-1'), example('SW-2'), example('SW-3')]
    first = build_snapshot(rows, version='dataset-3')
    second = build_snapshot(list(reversed(rows)), version='dataset-3')

    assert first.digest == second.digest
    assert first.splits == second.splits
