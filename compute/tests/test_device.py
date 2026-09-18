from ecu_worker.device import DeviceFacts, choose_runtime_profile, reduce_batch_after_oom


def test_4070_laptop_profile_is_conservative_for_8gb_vram_and_16gb_ram():
    profile=choose_runtime_profile(DeviceFacts(cuda_available=True,vram_gb=8.0,ram_gb=16.0))
    assert profile.device=="cuda"
    assert profile.mixed_precision is True
    assert profile.batch_size<=16
    assert profile.stream_dataset is True


def test_low_memory_or_no_cuda_falls_back_to_cpu():
    profile=choose_runtime_profile(DeviceFacts(cuda_available=False,vram_gb=0.0,ram_gb=8.0))
    assert profile.device=="cpu"
    assert profile.mixed_precision is False
    assert profile.batch_size<=8


def test_cuda_oom_reduces_batch_until_one():
    assert reduce_batch_after_oom(16)==8
    assert reduce_batch_after_oom(3)==1
    assert reduce_batch_after_oom(1)==1
