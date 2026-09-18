from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DeviceFacts:
    cuda_available: bool
    vram_gb: float
    ram_gb: float


@dataclass(frozen=True)
class RuntimeProfile:
    device: str
    mixed_precision: bool
    batch_size: int
    gradient_accumulation: int
    stream_dataset: bool


def choose_runtime_profile(facts: DeviceFacts) -> RuntimeProfile:
    ram = max(0.0, float(facts.ram_gb))
    vram = max(0.0, float(facts.vram_gb))

    if not facts.cuda_available or vram < 4.0:
        batch = 4 if ram < 12 else 8
        return RuntimeProfile(
            device="cpu",
            mixed_precision=False,
            batch_size=batch,
            gradient_accumulation=1,
            stream_dataset=True,
        )

    if vram <= 8.5:
        return RuntimeProfile(
            device="cuda",
            mixed_precision=True,
            batch_size=8,
            gradient_accumulation=4,
            stream_dataset=True,
        )

    return RuntimeProfile(
        device="cuda",
        mixed_precision=True,
        batch_size=16 if ram >= 16 else 8,
        gradient_accumulation=2,
        stream_dataset=True,
    )


def reduce_batch_after_oom(batch_size: int) -> int:
    size = max(1, int(batch_size))
    if size <= 1:
        return 1
    return max(1, size // 2)
