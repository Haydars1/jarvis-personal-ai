ALTER TABLE ecu_change_evidence ADD COLUMN verification_method TEXT NOT NULL DEFAULT 'human';

CREATE INDEX IF NOT EXISTS idx_ecu_change_evidence_verification_method
ON ecu_change_evidence(verification_method,operation_label,ecu_family,hw,sw,semantic_label,map_offset,created_at DESC);
