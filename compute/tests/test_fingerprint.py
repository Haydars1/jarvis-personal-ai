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
