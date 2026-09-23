-- ECU Brain core metadata. This branch migration has not been released;
-- keep it aligned with the current runtime before first production merge.
CREATE TABLE IF NOT EXISTS ecu_files (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL DEFAULT '',
  artifact_uri TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
  immutable INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ecu_files_sha ON ecu_files(sha256);
CREATE INDEX IF NOT EXISTS idx_ecu_files_created ON ecu_files(created_at DESC);

CREATE TABLE IF NOT EXISTS ecu_jobs (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  operation TEXT NOT NULL DEFAULT 'analyze',
  state TEXT NOT NULL DEFAULT 'QUEUED' CHECK(state IN ('QUEUED','DISPATCHED','RUNNING','NEEDS_REVIEW','READY','FAILED')),
  run_fingerprint TEXT,
  model_version TEXT,
  rulepack_version TEXT,
  worker_kind TEXT,
  result_json TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(file_id) REFERENCES ecu_files(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ecu_jobs_fingerprint ON ecu_jobs(run_fingerprint) WHERE run_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ecu_jobs_state ON ecu_jobs(state, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ecu_jobs_file ON ecu_jobs(file_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ecu_job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL CHECK(to_state IN ('QUEUED','DISPATCHED','RUNNING','NEEDS_REVIEW','READY','FAILED')),
  reason TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(job_id) REFERENCES ecu_jobs(id)
);
CREATE INDEX IF NOT EXISTS idx_ecu_job_events_job ON ecu_job_events(job_id, created_at ASC);
