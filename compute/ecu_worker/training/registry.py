from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelVersion:
    version: str
    dataset_version: str
    benchmark_score: float
    artifact_uri: str


@dataclass(frozen=True)
class PromotionResult:
    promoted: bool
    reason: str
    previous_version: str | None
    production_version: str


class ModelRegistry:
    def __init__(self, production: ModelVersion):
        self.production = production
        self.rollback_target: ModelVersion | None = None

    def promote_if_better(self, candidate: ModelVersion) -> PromotionResult:
        previous = self.production
        if candidate.benchmark_score <= previous.benchmark_score:
            return PromotionResult(
                promoted=False,
                reason='BENCHMARK_NOT_BETTER',
                previous_version=previous.version,
                production_version=previous.version,
            )

        self.rollback_target = previous
        self.production = candidate
        return PromotionResult(
            promoted=True,
            reason='BENCHMARK_IMPROVED',
            previous_version=previous.version,
            production_version=candidate.version,
        )

    def rollback(self) -> ModelVersion:
        if self.rollback_target is None:
            raise RuntimeError('NO_ROLLBACK_TARGET')
        current = self.production
        target = self.rollback_target
        self.production = target
        self.rollback_target = current
        return self.production
