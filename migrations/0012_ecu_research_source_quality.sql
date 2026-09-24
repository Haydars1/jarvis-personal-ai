ALTER TABLE ecu_knowledge_sources ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'web';
ALTER TABLE ecu_knowledge_sources ADD COLUMN trust_score REAL NOT NULL DEFAULT 0.5;

CREATE INDEX IF NOT EXISTS idx_ecu_knowledge_sources_trust
ON ecu_knowledge_sources(trust_score DESC, last_seen_at DESC);
