CREATE TABLE IF NOT EXISTS ecu_change_hypotheses (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  operation_label TEXT NOT NULL,
  ecu_family TEXT NOT NULL DEFAULT '',
  hw TEXT NOT NULL DEFAULT '',
  sw TEXT NOT NULL DEFAULT '',
  semantic_label TEXT NOT NULL,
  map_offset INTEGER NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  delta_stats_json TEXT NOT NULL DEFAULT '{}',
  verification_state TEXT NOT NULL DEFAULT 'UNVERIFIED',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(pair_id) REFERENCES ecu_training_pairs(id)
);

CREATE INDEX IF NOT EXISTS idx_ecu_change_hypotheses_scope
ON ecu_change_hypotheses(operation_label,ecu_family,hw,sw,semantic_label,map_offset,verification_state,created_at DESC);
