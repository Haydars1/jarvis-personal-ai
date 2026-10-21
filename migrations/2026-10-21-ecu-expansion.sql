-- ECU Expansion Migration — 2026-10-21
-- Adds columns needed by enriched upload/generate/download handlers
-- and ensures runtime column names align with inline handler expectations
--
-- NOTE: ecu_tuned_outputs runtime uses column names that differ from the
-- original 2026-10-05 migration. If the table was created from that file,
-- run the ALTER statements below to add the runtime columns the handlers expect.
-- If the table already has these columns (created interactively), these will
-- no-op via the IF NOT EXISTS pattern (D1 ignores duplicate ADD COLUMN).

-- 1. ecu_uploads: analysis cache (may already exist from 2026-10-14 migration)
--    Safe to re-run: D1 will error on duplicate but wrapped in try
ALTER TABLE ecu_uploads ADD COLUMN analysis_json TEXT;
ALTER TABLE ecu_uploads ADD COLUMN analyzed_at INTEGER;

-- 2. ecu_definition_sets: link to upload (may already exist from 2026-10-14 migration)
ALTER TABLE ecu_definition_sets ADD COLUMN upload_id TEXT;
CREATE INDEX IF NOT EXISTS idx_ecu_defset_upload ON ecu_definition_sets(upload_id);

-- 3. ecu_tuned_outputs: ensure runtime columns exist
--    The original migration created proposal_id, tuned_binary, tuned_hash, etc.
--    Runtime handlers use: vehicle_id, proposals_applied, tuned_file_hash,
--    tuned_file_size, tuned_binary_data
--    These ALTERs add the runtime columns if missing.
ALTER TABLE ecu_tuned_outputs ADD COLUMN vehicle_id TEXT;
ALTER TABLE ecu_tuned_outputs ADD COLUMN proposals_applied TEXT;
ALTER TABLE ecu_tuned_outputs ADD COLUMN tuned_file_hash TEXT;
ALTER TABLE ecu_tuned_outputs ADD COLUMN tuned_file_size INTEGER;
ALTER TABLE ecu_tuned_outputs ADD COLUMN tuned_binary_data TEXT;

-- 4. Indexes for new query patterns used by expansion endpoints
CREATE INDEX IF NOT EXISTS idx_ecu_tuned_upload ON ecu_tuned_outputs(upload_id);
CREATE INDEX IF NOT EXISTS idx_ecu_tuned_created ON ecu_tuned_outputs(created_at);
CREATE INDEX IF NOT EXISTS idx_ecu_uploads_created ON ecu_uploads(created_at);
CREATE INDEX IF NOT EXISTS idx_ecu_uploads_format ON ecu_uploads(format);
CREATE INDEX IF NOT EXISTS idx_ecu_history_upload ON ecu_tuning_history(upload_id);
CREATE INDEX IF NOT EXISTS idx_ecu_history_type ON ecu_tuning_history(tuning_type);
CREATE INDEX IF NOT EXISTS idx_ecu_history_created ON ecu_tuning_history(created_at);
