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


def test_release_allows_only_checksum_field_added_by_verified_profile():
    from ecu_worker.validation import ProfileChecksumAdapter
    ori=bytes.fromhex("010203040000")
    candidate=bytes.fromhex("010903040000")
    adapter=ProfileChecksumAdapter({
        "algorithm":"sum16",
        "data_start":0,
        "data_end":6,
        "checksum_offset":4,
        "checksum_size":2,
        "endian":"big",
        "zero_field":True,
    })
    decision=build_release_decision(
        ori,candidate,
        allowed_ranges=[(1,2)],
        checksum_adapter=adapter,
    )
    assert decision.ready is True
    assert decision.mod_bytes is not None
    assert decision.mod_bytes[1]==9
    assert decision.mod_bytes[4:6]==bytes.fromhex("0010")
    assert decision.checksum_algorithm=="profile-sum16"


class CorrectingChecksum(ChecksumAdapter):
    name="fixture-correcting"
    def correct(self,data:bytes)->bytes:
        out=bytearray(data)
        out[-1]=0xAA
        return bytes(out)
    def verify(self,data:bytes)->ChecksumResult:
        ok=bool(data) and data[-1]==0xAA
        return ChecksumResult(status="VERIFIED" if ok else "FAILED",algorithm=self.name,verified=ok)


def test_release_accepts_adapter_checksum_correction_offsets():
    ori=bytes([0,1,2,3,4,5])
    candidate=bytes([0,9,2,3,4,5])
    decision=build_release_decision(
        ori,candidate,allowed_ranges=[(1,2)],checksum_adapter=CorrectingChecksum()
    )
    assert decision.ready is True
    assert decision.mod_bytes==bytes([0,9,2,3,4,0xAA])
    assert decision.checksum_algorithm=="fixture-correcting"
    assert decision.changed_offsets==[1,5]
