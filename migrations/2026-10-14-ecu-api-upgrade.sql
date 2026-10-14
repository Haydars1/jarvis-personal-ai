-- ECU API upgrade: analysis cache + definition set link to uploads
-- Adds analysis_json/analyzed_at to ecu_uploads for caching scanRegions() results
-- Adds upload_id to ecu_definition_sets so definitions can be linked to specific uploads

ALTER TABLE ecu_uploads ADD COLUMN analysis_json TEXT;
ALTER TABLE ecu_uploads ADD COLUMN analyzed_at INTEGER;

ALTER TABLE ecu_definition_sets ADD COLUMN upload_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ecu_defset_upload ON ecu_definition_sets(upload_id);
