from ecu_worker.validation import ChecksumResult, validate_mod_candidate


def test_validation_blocks_size_changes_and_unknown_edits():
    ori = bytes([0, 1, 2, 3, 4, 5])
    mod = bytes([0, 1, 9, 3, 4, 5])
    result = validate_mod_candidate(
        ori,
        mod,
        allowed_ranges=[(0, 2)],
        checksum=ChecksumResult(status="UNSUPPORTED", algorithm=None, verified=False),
    )
    assert result.ready is False
    assert "UNKNOWN_EDIT" in result.errors
    assert "CHECKSUM_UNSUPPORTED" in result.errors


def test_validation_accepts_only_in_range_edits_but_still_blocks_unsupported_checksum():
    ori = bytes([0, 1, 2, 3, 4, 5])
    mod = bytes([0, 9, 2, 3, 4, 5])
    result = validate_mod_candidate(
        ori,
        mod,
        allowed_ranges=[(1, 2)],
        checksum=ChecksumResult(status="UNSUPPORTED", algorithm=None, verified=False),
    )
    assert result.changed_offsets == [1]
    assert "UNKNOWN_EDIT" not in result.errors
    assert result.ready is False
    assert "CHECKSUM_UNSUPPORTED" in result.errors


def test_validation_never_fabricates_checksum_support():
    result = validate_mod_candidate(
        b"abc",
        b"abc",
        allowed_ranges=[],
        checksum=ChecksumResult(status="VERIFIED", algorithm="verified-test-adapter", verified=True),
    )
    assert result.ready is True
    assert result.errors == []
