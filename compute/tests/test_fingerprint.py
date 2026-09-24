from ecu_worker.features import byte_entropy, printable_strings
from ecu_worker.fingerprint import fingerprint_binary


def test_entropy_handles_uniform_and_varied_bytes():
    assert byte_entropy(b'\x00' * 256) == 0.0
    assert byte_entropy(bytes(range(256))) > 7.9


def test_printable_strings_extracts_meaningful_tokens():
    data = b'\x00\x01BOSCH\x00EDC17C46\x00SW:1037500001\x00'
    strings = printable_strings(data, min_length=4)
    assert 'BOSCH' in strings
    assert 'EDC17C46' in strings
    assert 'SW:1037500001' in strings


def test_fingerprint_detects_explicit_edc17c46_marker_with_evidence():
    data = b'\x00' * 100 + b'BOSCH EDC17C46 SW:1037500001 HW:0281012345' + b'\xff' * 100
    result = fingerprint_binary(data)
    assert result.ecu_family == 'EDC17C46'
    assert result.confidence >= 0.9
    assert any('EDC17C46' in evidence for evidence in result.evidence)
    assert '1037500001' in result.sw_candidates
    assert '0281012345' in result.hw_candidates


def test_fingerprint_keeps_unknown_binary_unknown():
    result = fingerprint_binary(bytes(range(64)))
    assert result.ecu_family == 'UNKNOWN'
    assert result.confidence == 0.0
    assert result.supported is False


def test_recognizes_common_ecu_family_markers():
    from ecu_worker.fingerprint import fingerprint_binary

    cases = [
        (b"xxxx BOSCH EDC16U34 HW:123456 SW:654321 xxxx", "EDC16U34"),
        (b"xxxx BOSCH MED17.5.5 HW:123456 SW:654321 xxxx", "MED17.5.5"),
        (b"xxxx BOSCH MD1CS004 HW:123456 SW:654321 xxxx", "MD1CS004"),
        (b"xxxx CONTINENTAL SID807 HW:123456 SW:654321 xxxx", "SID807"),
        (b"xxxx DELPHI DCM3.7 HW:123456 SW:654321 xxxx", "DCM3.7"),
    ]
    for payload, family in cases:
        result = fingerprint_binary(payload)
        assert result.ecu_family == family
        assert result.supported is True
        assert result.confidence >= 0.9


def test_scored_fingerprint_supports_more_ecu_families():
    from ecu_worker.fingerprint import fingerprint_binary

    cases = [
        (b"BOSCH MEDC17.9.8 HW:12345678 SW:87654321", "MEDC17.9.8"),
        (b"BOSCH EDC15P HW:12345678 SW:87654321", "EDC15P"),
        (b"BOSCH ME7.5 HW:12345678 SW:87654321", "ME7.5"),
        (b"SIEMENS SIMOS18.1 HW:12345678 SW:87654321", "SIMOS18.1"),
        (b"MARELLI MJD6JF HW:12345678 SW:87654321", "MJD6JF"),
        (b"DENSO SH7058 HW:12345678 SW:87654321", "SH7058"),
    ]
    for payload, family in cases:
        result = fingerprint_binary(payload)
        assert result.ecu_family == family
        assert result.supported is True
        assert result.confidence >= 0.9


def test_fingerprint_records_missing_expected_vendor_as_evidence():
    from ecu_worker.fingerprint import fingerprint_binary
    result=fingerprint_binary(b"EDC17C46 HW:12345678 SW:87654321")
    assert result.ecu_family=="EDC17C46"
    assert result.supported is True
    assert any("vendor marker missing" in item for item in result.evidence)
