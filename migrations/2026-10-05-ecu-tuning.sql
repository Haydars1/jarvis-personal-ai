-- ECU Tuning Module Schema
-- Run: wrangler d1 execute jarvis-db --file ecu-tuning-migration.sql

CREATE TABLE IF NOT EXISTS ecu_uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  format TEXT NOT NULL,
  vehicle_type TEXT,
  vehicle_model TEXT,
  file_hash TEXT NOT NULL,
  file_size INTEGER,
  binary_data BLOB NOT NULL,
  uploaded_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ecu_proposals (
  id TEXT PRIMARY KEY,
  upload_id TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  proposal_type TEXT NOT NULL,
  proposal_data TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  user_confirmed BOOLEAN DEFAULT 0,
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (upload_id) REFERENCES ecu_uploads(id)
);

CREATE TABLE IF NOT EXISTS ecu_tuned_outputs (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  upload_id TEXT NOT NULL,
  tuned_binary BLOB NOT NULL,
  tuned_hash TEXT NOT NULL,
  tuned_size INTEGER,
  applied_changes TEXT NOT NULL,
  status TEXT DEFAULT 'ready',
  download_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (proposal_id) REFERENCES ecu_proposals(id),
  FOREIGN KEY (upload_id) REFERENCES ecu_uploads(id)
);

CREATE TABLE IF NOT EXISTS ecu_tuning_history (
  id TEXT PRIMARY KEY,
  upload_id TEXT,
  vehicle_type TEXT,
  tuning_type TEXT,
  status TEXT,
  error_msg TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ecu_uploads_user ON ecu_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_ecu_uploads_hash ON ecu_uploads(file_hash);
CREATE INDEX IF NOT EXISTS idx_ecu_proposals_upload ON ecu_proposals(upload_id);
CREATE INDEX IF NOT EXISTS idx_ecu_proposals_status ON ecu_proposals(status);
CREATE INDEX IF NOT EXISTS idx_ecu_tuned_proposal ON ecu_tuned_outputs(proposal_id);
