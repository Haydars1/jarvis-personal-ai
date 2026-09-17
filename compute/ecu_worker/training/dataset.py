from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha256
import json


@dataclass(frozen=True)
class TrainingExample:
    ecu_family: str
    hw: str
    sw: str
    artifact_sha256: str
    map_offset: int
    semantic_label: str
    source_type: str
    source_confidence: float
    human_verified: bool = False

    @property
    def group_key(self) -> tuple[str, str, str]:
        return (self.ecu_family, self.hw, self.sw)


@dataclass(frozen=True)
class DatasetSnapshot:
    version: str
    examples: list[TrainingExample]
    splits: dict[str, list[TrainingExample]]
    digest: str


def _example_key(row: TrainingExample) -> tuple:
    return (
        row.ecu_family,
        row.hw,
        row.sw,
        row.artifact_sha256,
        row.map_offset,
        row.semantic_label,
        row.source_type,
        row.source_confidence,
    )


def _partition(group_key: tuple[str, str, str]) -> str:
    token = '|'.join(group_key).encode('utf-8')
    bucket = int.from_bytes(sha256(token).digest()[:2], 'big') % 100
    if bucket < 80:
        return 'train'
    if bucket < 90:
        return 'validation'
    return 'test'


def _canonical_payload(version: str, splits: dict[str, list[TrainingExample]]) -> bytes:
    serializable = {
        'version': version,
        'splits': {
            name: [asdict(row) for row in rows]
            for name, rows in sorted(splits.items())
        },
    }
    return json.dumps(
        serializable,
        sort_keys=True,
        separators=(',', ':'),
        ensure_ascii=True,
    ).encode('utf-8')


def build_snapshot(rows: list[TrainingExample], version: str) -> DatasetSnapshot:
    verified = sorted((row for row in rows if row.human_verified), key=_example_key)
    splits: dict[str, list[TrainingExample]] = {
        'train': [],
        'validation': [],
        'test': [],
    }
    for row in verified:
        splits[_partition(row.group_key)].append(row)

    digest = sha256(_canonical_payload(version, splits)).hexdigest()
    return DatasetSnapshot(
        version=version,
        examples=verified,
        splits=splits,
        digest=digest,
    )
