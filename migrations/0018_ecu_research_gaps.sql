CREATE TABLE IF NOT EXISTS ecu_research_gaps (
  id TEXT PRIMARY KEY,
  ecu_family TEXT NOT NULL DEFAULT '',
  hw TEXT NOT NULL DEFAULT '',
  sw TEXT NOT NULL DEFAULT '',
  operation_label TEXT NOT NULL,
  last_researched_at INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sources_found INTEGER NOT NULL DEFAULT 0,
  last_claims_found INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ecu_research_gaps_due
ON ecu_research_gaps(last_researched_at ASC, updated_at ASC);
