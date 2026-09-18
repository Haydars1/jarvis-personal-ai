-- JARVIS ECU Brain additive schema. Safe to apply repeatedly.
CREATE TABLE IF NOT EXISTS ecu_files (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL DEFAULT '',
  artifact_uri TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  immutable INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ecu_files_sha ON ecu_files(sha256);

CREATE TABLE IF NOT EXISTS ecu_jobs (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  operation TEXT NOT NULL DEFAULT 'analyze',
  state TEXT NOT NULL DEFAULT 'QUEUED',
  run_fingerprint TEXT,
  model_version TEXT,
  rulepack_version TEXT,
  worker_kind TEXT,
  result_json TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ecu_jobs_state ON ecu_jobs(state, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ecu_jobs_fingerprint ON ecu_jobs(run_fingerprint) WHERE run_fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS ecu_analysis_results (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  ecu_family TEXT,
  hw_candidates TEXT NOT NULL DEFAULT '[]',
  sw_candidates TEXT NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 0,
  evidence TEXT NOT NULL DEFAULT '[]',
  feature_schema_version TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ecu_map_candidates (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  map_offset INTEGER NOT NULL,
  rows INTEGER,
  cols INTEGER,
  data_type TEXT,
  endian TEXT,
  semantic_label TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  features_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ecu_maps_job ON ecu_map_candidates(job_id, confidence DESC);

CREATE TABLE IF NOT EXISTS ecu_knowledge_sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  verified INTEGER NOT NULL DEFAULT 0,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ecu_knowledge_claims (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  verification_state TEXT NOT NULL DEFAULT 'UNVERIFIED',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ecu_claims_verification ON ecu_knowledge_claims(verification_state, updated_at DESC);

CREATE TABLE IF NOT EXISTS ecu_training_examples (
  id TEXT PRIMARY KEY,
  ecu_family TEXT NOT NULL,
  hw TEXT NOT NULL DEFAULT '',
  sw TEXT NOT NULL DEFAULT '',
  artifact_sha256 TEXT NOT NULL,
  map_offset INTEGER,
  semantic_label TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  source_confidence REAL NOT NULL DEFAULT 0,
  human_verified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ecu_training_verified ON ecu_training_examples(human_verified, ecu_family, sw);

CREATE TABLE IF NOT EXISTS ecu_dataset_versions (
  version TEXT PRIMARY KEY,
  digest TEXT NOT NULL UNIQUE,
  example_count INTEGER NOT NULL,
  artifact_uri TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ecu_model_versions (
  version TEXT PRIMARY KEY,
  dataset_version TEXT NOT NULL,
  benchmark_score REAL NOT NULL,
  artifact_uri TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'CANDIDATE',
  rollback_target TEXT,
  created_at INTEGER NOT NULL,
  promoted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ecu_models_state ON ecu_model_versions(state, created_at DESC);

CREATE TABLE IF NOT EXISTS ecu_benchmarks (
  id TEXT PRIMARY KEY,
  model_version TEXT NOT NULL,
  dataset_version TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  score REAL NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ecu_research_runs (
  id TEXT PRIMARY KEY,
  bucket INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  sources_found INTEGER NOT NULL DEFAULT 0,
  claims_found INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ecu_research_created ON ecu_research_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS ecu_training_runs (
  id TEXT PRIMARY KEY,
  bucket INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  run_fingerprint TEXT,
  worker_kind TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ecu_training_runs_created ON ecu_training_runs(created_at DESC);


CREATE TABLE IF NOT EXISTS ecu_training_features (
  example_id TEXT PRIMARY KEY,
  features_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
