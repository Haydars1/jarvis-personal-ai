CREATE TABLE IF NOT EXISTS ecu_checksum_profiles(
  id TEXT PRIMARY KEY,
  ecu_family TEXT NOT NULL,
  hw TEXT NOT NULL DEFAULT '',
  sw TEXT NOT NULL DEFAULT '',
  algorithm TEXT NOT NULL,
  data_start INTEGER NOT NULL,
  data_end INTEGER NOT NULL,
  checksum_offset INTEGER NOT NULL,
  checksum_size INTEGER NOT NULL,
  endian TEXT NOT NULL DEFAULT 'big',
  zero_field INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'EVIDENCE_CANDIDATE',
  verified INTEGER NOT NULL DEFAULT 0,
  verified_pairs INTEGER NOT NULL DEFAULT 0,
  digest TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  promoted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ecu_checksum_profiles_scope
ON ecu_checksum_profiles(ecu_family,hw,sw,state,verified,promoted_at DESC,created_at DESC);
