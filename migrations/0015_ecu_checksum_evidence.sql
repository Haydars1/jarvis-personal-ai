CREATE TABLE IF NOT EXISTS ecu_checksum_evidence(
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  ecu_family TEXT NOT NULL DEFAULT '',
  hw TEXT NOT NULL DEFAULT '',
  sw TEXT NOT NULL DEFAULT '',
  algorithm TEXT NOT NULL,
  data_start INTEGER NOT NULL,
  data_end INTEGER NOT NULL,
  checksum_offset INTEGER NOT NULL,
  checksum_size INTEGER NOT NULL,
  endian TEXT NOT NULL,
  zero_field INTEGER NOT NULL DEFAULT 1,
  human_verified INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(pair_id,algorithm,data_start,data_end,checksum_offset,checksum_size,endian)
);

CREATE INDEX IF NOT EXISTS idx_ecu_checksum_evidence_scope
ON ecu_checksum_evidence(ecu_family,hw,sw,algorithm,checksum_offset,checksum_size,endian,human_verified,created_at DESC);
