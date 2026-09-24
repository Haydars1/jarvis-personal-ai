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


def test_checksum_registry_defaults_to_unsupported_for_unknown_family():
    from ecu_worker.validation import ChecksumRegistry
    registry=ChecksumRegistry()
    result=registry.verify("EDC17C46",b"abc")
    assert result.status=="UNSUPPORTED"
    assert result.verified is False


def test_checksum_registry_uses_only_explicitly_registered_adapter():
    from ecu_worker.validation import ChecksumAdapter, ChecksumRegistry

    class VerifiedFixture(ChecksumAdapter):
        name="verified-fixture"
        def verify(self,data:bytes)->ChecksumResult:
            return ChecksumResult(status="VERIFIED",algorithm=self.name,verified=True)

    registry=ChecksumRegistry({"FIXTURE_ECU":VerifiedFixture()})
    assert registry.verify("FIXTURE_ECU",b"abc").verified is True
    assert registry.verify("EDC17C46",b"abc").status=="UNSUPPORTED"


def test_profile_checksum_adapter_repairs_and_verifies_sum16():
    from ecu_worker.validation import ProfileChecksumAdapter
    data=bytes.fromhex("010203040000")
    adapter=ProfileChecksumAdapter({
        "algorithm":"sum16",
        "data_start":0,
        "data_end":6,
        "checksum_offset":4,
        "checksum_size":2,
        "endian":"big",
        "zero_field":True,
    })
    before=adapter.verify(data)
    assert before.verified is False
    applied=adapter.apply(data)
    assert applied.result.verified is True
    assert applied.ranges==[(4,6)]
    assert applied.data[-2:]==bytes.fromhex("000a")


def test_profile_checksum_adapter_supports_crc32():
    import zlib
    from ecu_worker.validation import ProfileChecksumAdapter
    prefix=b"ABCD"
    payload=prefix+b"\x00\x00\x00\x00"
    adapter=ProfileChecksumAdapter({
        "algorithm":"crc32",
        "data_start":0,
        "data_end":8,
        "checksum_offset":4,
        "checksum_size":4,
        "endian":"big",
        "zero_field":True,
    })
    applied=adapter.apply(payload)
    expected=zlib.crc32(prefix+b"\x00\x00\x00\x00") & 0xffffffff
    assert int.from_bytes(applied.data[4:8],"big")==expected
    assert applied.result.verified is True
