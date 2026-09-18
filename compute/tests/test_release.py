from ecu_worker.release import build_release_decision
from ecu_worker.validation import ChecksumAdapter, ChecksumResult


class VerifiedChecksum(ChecksumAdapter):
    name="fixture-verified"
    def verify(self,data:bytes)->ChecksumResult:
        return ChecksumResult(status="VERIFIED",algorithm=self.name,verified=True)


def test_release_is_blocked_when_checksum_support_is_unknown():
    ori=bytes([0,1,2,3,4,5])
    candidate=bytes([0,9,2,3,4,5])
    decision=build_release_decision(ori,candidate,allowed_ranges=[(1,2)],checksum_adapter=ChecksumAdapter())
    assert decision.ready is False
    assert decision.mod_bytes is None
    assert "CHECKSUM_UNSUPPORTED" in decision.errors


def test_release_is_blocked_on_unknown_byte_edit_even_with_verified_checksum():
    ori=bytes([0,1,2,3,4,5])
    candidate=bytes([0,1,9,3,4,5])
    decision=build_release_decision(ori,candidate,allowed_ranges=[(0,2)],checksum_adapter=VerifiedChecksum())
    assert decision.ready is False
    assert decision.mod_bytes is None
    assert "UNKNOWN_EDIT" in decision.errors


def test_release_returns_mod_only_after_validation_and_verified_checksum():
    ori=bytes([0,1,2,3,4,5])
    candidate=bytes([0,9,2,3,4,5])
    decision=build_release_decision(ori,candidate,allowed_ranges=[(1,2)],checksum_adapter=VerifiedChecksum())
    assert decision.ready is True
    assert decision.errors==[]
    assert decision.mod_bytes==candidate
    assert decision.checksum_algorithm=="fixture-verified"
