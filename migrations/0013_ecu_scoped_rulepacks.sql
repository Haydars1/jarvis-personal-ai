ALTER TABLE ecu_training_pairs ADD COLUMN ecu_family TEXT NOT NULL DEFAULT '';
ALTER TABLE ecu_training_pairs ADD COLUMN hw TEXT NOT NULL DEFAULT '';
ALTER TABLE ecu_training_pairs ADD COLUMN sw TEXT NOT NULL DEFAULT '';

ALTER TABLE ecu_change_evidence ADD COLUMN ecu_family TEXT NOT NULL DEFAULT '';
ALTER TABLE ecu_change_evidence ADD COLUMN hw TEXT NOT NULL DEFAULT '';
ALTER TABLE ecu_change_evidence ADD COLUMN sw TEXT NOT NULL DEFAULT '';

ALTER TABLE ecu_rulepack_versions ADD COLUMN ecu_family TEXT NOT NULL DEFAULT '';
ALTER TABLE ecu_rulepack_versions ADD COLUMN hw TEXT NOT NULL DEFAULT '';
ALTER TABLE ecu_rulepack_versions ADD COLUMN sw TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_ecu_pairs_scope
ON ecu_training_pairs(operation_label,ecu_family,hw,sw,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ecu_evidence_scope
ON ecu_change_evidence(operation_label,ecu_family,hw,sw,semantic_label,human_verified,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ecu_rulepacks_scope
ON ecu_rulepack_versions(operation_label,ecu_family,hw,sw,state,verified,created_at DESC);
