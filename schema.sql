CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'Orta', status TEXT NOT NULL DEFAULT 'open', area TEXT NOT NULL DEFAULT 'genel', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'genel', status TEXT NOT NULL DEFAULT 'active', notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, text TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, ts INTEGER NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, meta TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS actions (id TEXT PRIMARY KEY, type TEXT NOT NULL, payload TEXT NOT NULL, summary TEXT NOT NULL, risk TEXT NOT NULL DEFAULT 'medium', status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, completed_at INTEGER);
CREATE TABLE IF NOT EXISTS tool_registry (id TEXT PRIMARY KEY, name TEXT NOT NULL, capability TEXT NOT NULL, endpoint TEXT, auth_type TEXT NOT NULL DEFAULT 'none', enabled INTEGER NOT NULL DEFAULT 1, priority INTEGER NOT NULL DEFAULT 100, meta TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_tools_capability ON tool_registry(capability, enabled, priority);

CREATE TABLE IF NOT EXISTS credentials (id TEXT PRIMARY KEY, provider TEXT NOT NULL, label TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'api_key', encrypted_secret TEXT NOT NULL, capabilities TEXT NOT NULL DEFAULT '[]', endpoint TEXT, model TEXT, priority INTEGER NOT NULL DEFAULT 100, enabled INTEGER NOT NULL DEFAULT 1, meta TEXT NOT NULL DEFAULT '{}', last_status TEXT NOT NULL DEFAULT 'untested', last_error TEXT, last_test_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_credentials_enabled ON credentials(enabled, priority);
CREATE TABLE IF NOT EXISTS executions (id TEXT PRIMARY KEY, command TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'running', step INTEGER NOT NULL DEFAULT 0, provider TEXT, result TEXT, error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status, updated_at DESC);
CREATE TABLE IF NOT EXISTS change_requests (id TEXT PRIMARY KEY, request TEXT NOT NULL, origin TEXT NOT NULL DEFAULT 'user', status TEXT NOT NULL DEFAULT 'queued', provider TEXT, repo TEXT, branch TEXT, pr_url TEXT, summary TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_change_requests_created ON change_requests(created_at DESC);
CREATE TABLE IF NOT EXISTS runtime_errors (id TEXT PRIMARY KEY, ts INTEGER NOT NULL, context TEXT, message TEXT NOT NULL, fingerprint TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_runtime_errors_fp ON runtime_errors(fingerprint,resolved,ts DESC);
CREATE TABLE IF NOT EXISTS passkeys (id TEXT PRIMARY KEY, public_key TEXT NOT NULL, counter INTEGER NOT NULL DEFAULT 0, transports TEXT NOT NULL DEFAULT '[]', device_type TEXT, backed_up INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, last_used_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_passkeys_created ON passkeys(created_at DESC);
CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, role TEXT NOT NULL, content TEXT NOT NULL, provider TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE TABLE IF NOT EXISTS agent_jobs (id TEXT PRIMARY KEY, request TEXT NOT NULL, plan TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'running', current_step INTEGER NOT NULL DEFAULT 0, result TEXT, error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_status ON agent_jobs(status, updated_at DESC);
CREATE TABLE IF NOT EXISTS provider_metrics (provider TEXT PRIMARY KEY, samples INTEGER NOT NULL DEFAULT 0, successes INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0, avg_latency_ms REAL NOT NULL DEFAULT 0, last_latency_ms INTEGER, last_error TEXT, updated_at INTEGER NOT NULL);

-- Additive Learning Engine storage. Existing memories/provider_metrics stay compatible.
CREATE TABLE IF NOT EXISTS learning_events (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, domain TEXT NOT NULL DEFAULT 'general', provider TEXT, outcome TEXT,
  latency_ms INTEGER NOT NULL DEFAULT 0, error_class TEXT, meta TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_learning_events_domain ON learning_events(domain, created_at DESC);
CREATE TABLE IF NOT EXISTS knowledge_memories (
  id TEXT PRIMARY KEY, domain TEXT NOT NULL DEFAULT 'general', text TEXT NOT NULL, source_url TEXT NOT NULL,
  source_title TEXT NOT NULL DEFAULT '', confidence REAL NOT NULL DEFAULT 0.7, observed_at INTEGER NOT NULL,
  verified_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active', supersedes_id TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_active ON knowledge_memories(domain, status, expires_at, confidence DESC);
CREATE TABLE IF NOT EXISTS provider_domain_metrics (
  provider TEXT NOT NULL, domain TEXT NOT NULL, samples INTEGER NOT NULL DEFAULT 0, successes INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0, avg_latency_ms REAL NOT NULL DEFAULT 0, recent_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT, updated_at INTEGER NOT NULL, PRIMARY KEY(provider, domain)
);
CREATE TABLE IF NOT EXISTS personal_memory_meta (
  memory_id TEXT PRIMARY KEY, normalized_text TEXT NOT NULL, domain TEXT NOT NULL DEFAULT 'general', confidence REAL NOT NULL DEFAULT 0.7,
  seen_count INTEGER NOT NULL DEFAULT 1, last_seen_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_memory_normalized ON personal_memory_meta(normalized_text);

CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'info', title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', read INTEGER NOT NULL DEFAULT 0, meta TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(read, created_at DESC);
CREATE TABLE IF NOT EXISTS push_devices (id TEXT PRIMARY KEY, device_token TEXT NOT NULL UNIQUE, platform TEXT NOT NULL DEFAULT 'ios', environment TEXT NOT NULL DEFAULT 'sandbox', app_bundle TEXT NOT NULL DEFAULT 'com.haydojarvis.jarvis', enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, last_success_at INTEGER, last_error TEXT);
CREATE INDEX IF NOT EXISTS idx_push_devices_enabled ON push_devices(platform, enabled, last_seen_at DESC);
CREATE TABLE IF NOT EXISTS push_deliveries (notification_id TEXT NOT NULL, device_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', apns_id TEXT, error TEXT, attempted_at INTEGER, sent_at INTEGER, PRIMARY KEY(notification_id, device_id));
CREATE INDEX IF NOT EXISTS idx_push_deliveries_status ON push_deliveries(status, attempted_at DESC);
CREATE TABLE IF NOT EXISTS watches (id TEXT PRIMARY KEY, title TEXT NOT NULL, query TEXT NOT NULL, condition_text TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, interval_minutes INTEGER NOT NULL DEFAULT 30, last_checked_at INTEGER, last_fingerprint TEXT, last_result TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_watches_due ON watches(enabled, last_checked_at);
CREATE TABLE IF NOT EXISTS social_campaigns (id TEXT PRIMARY KEY, name TEXT NOT NULL, objective TEXT NOT NULL DEFAULT 'growth', platforms TEXT NOT NULL DEFAULT '["instagram"]', topic TEXT NOT NULL, audience TEXT NOT NULL DEFAULT '', cadence TEXT NOT NULL DEFAULT 'daily', enabled INTEGER NOT NULL DEFAULT 1, approval_mode TEXT NOT NULL DEFAULT 'auto_owned_accounts', config TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_social_campaigns_enabled ON social_campaigns(enabled, updated_at DESC);
CREATE TABLE IF NOT EXISTS social_content_queue (id TEXT PRIMARY KEY, campaign_id TEXT, platform TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'reel', topic TEXT NOT NULL DEFAULT '', hook TEXT NOT NULL DEFAULT '', caption TEXT NOT NULL DEFAULT '', hashtags TEXT NOT NULL DEFAULT '[]', media_prompt TEXT NOT NULL DEFAULT '', media_url TEXT, external_job_id TEXT, status TEXT NOT NULL DEFAULT 'planned', scheduled_at INTEGER, published_at INTEGER, remote_id TEXT, error TEXT, meta TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_social_queue_due ON social_content_queue(status, scheduled_at);
CREATE TABLE IF NOT EXISTS social_targets (id TEXT PRIMARY KEY, platform TEXT NOT NULL, target_type TEXT NOT NULL, name TEXT NOT NULL, external_id TEXT, url TEXT, authorized INTEGER NOT NULL DEFAULT 0, auto_publish INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_social_targets_platform ON social_targets(platform, authorized, auto_publish);
CREATE TABLE IF NOT EXISTS social_events (id TEXT PRIMARY KEY, platform TEXT NOT NULL, event_type TEXT NOT NULL, external_id TEXT, actor TEXT, text TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL DEFAULT '{}', handled INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_social_events_new ON social_events(handled, created_at DESC);

-- Higgsfield provider registry. Model endpoints are discovered at runtime from the official OpenAPI document.
INSERT OR IGNORE INTO tool_registry(id,name,capability,endpoint,auth_type,enabled,priority,meta,created_at) VALUES
 ('higgsfield-video','Higgsfield','video-generation','https://api.higgsfield.ai','api_key_pair',1,15,'{"official":true,"docs":"https://docs.higgsfield.ai/docs","openapi":"https://docs.higgsfield.ai/docs/openapi.json"}',0),
 ('higgsfield-reels','Higgsfield','reels-video','https://api.higgsfield.ai','api_key_pair',1,15,'{"official":true,"aliasOf":"video-generation","docs":"https://docs.higgsfield.ai/docs","openapi":"https://docs.higgsfield.ai/docs/openapi.json"}',0),
 ('higgsfield-i2v','Higgsfield','image-to-video','https://api.higgsfield.ai','api_key_pair',1,15,'{"official":true,"docs":"https://docs.higgsfield.ai/docs","openapi":"https://docs.higgsfield.ai/docs/openapi.json"}',0),
 ('higgsfield-t2v','Higgsfield','text-to-video','https://api.higgsfield.ai','api_key_pair',1,15,'{"official":true,"docs":"https://docs.higgsfield.ai/docs","openapi":"https://docs.higgsfield.ai/docs/openapi.json"}',0);

-- Integrated from migrations/0010_ecu_brain_core.sql
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


-- Integrated from migrations/0011_ecu_brain_learning_release.sql
-- Additive ECU Brain learning, model, rulepack and validated MOD schema.
-- Kept separate from 0010 so an existing ECU core install can be upgraded safely.

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

CREATE TABLE IF NOT EXISTS ecu_training_features (
  example_id TEXT PRIMARY KEY,
  features_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ecu_training_pairs (
  id TEXT PRIMARY KEY,
  ori_file_id TEXT NOT NULL,
  mod_file_id TEXT NOT NULL,
  operation_label TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'QUEUED',
  run_fingerprint TEXT,
  worker_kind TEXT,
  diff_digest TEXT,
  diff_json TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ecu_training_pairs_state ON ecu_training_pairs(state, updated_at DESC);

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

CREATE TABLE IF NOT EXISTS ecu_change_evidence (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  operation_label TEXT NOT NULL DEFAULT '',
  semantic_label TEXT NOT NULL,
  range_start INTEGER NOT NULL,
  range_end INTEGER NOT NULL,
  map_offset INTEGER NOT NULL,
  overlap_bytes INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  delta_stats_json TEXT NOT NULL DEFAULT '{}',
  human_verified INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ecu_change_evidence_pair ON ecu_change_evidence(pair_id, semantic_label);
CREATE INDEX IF NOT EXISTS idx_ecu_change_evidence_label ON ecu_change_evidence(semantic_label, human_verified, created_at DESC);

CREATE TABLE IF NOT EXISTS ecu_rulepack_versions (
  version TEXT PRIMARY KEY,
  operation_label TEXT NOT NULL DEFAULT 'stage1',
  state TEXT NOT NULL DEFAULT 'EVIDENCE_CANDIDATE',
  verified INTEGER NOT NULL DEFAULT 0,
  rules_json TEXT NOT NULL DEFAULT '{}',
  evidence_count INTEGER NOT NULL DEFAULT 0,
  digest TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  promoted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ecu_rulepacks_state ON ecu_rulepack_versions(state, verified, created_at DESC);

CREATE TABLE IF NOT EXISTS ecu_mod_artifacts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL UNIQUE,
  artifact_uri TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum_algorithm TEXT NOT NULL,
  validation_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ecu_mod_artifacts_job ON ecu_mod_artifacts(job_id, created_at DESC);


CREATE TABLE IF NOT EXISTS ecu_workers (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'local',
  endpoint TEXT NOT NULL,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ecu_workers_live ON ecu_workers(kind, enabled, expires_at DESC, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS ecu_artifact_objects (object_key TEXT PRIMARY KEY,size_bytes INTEGER NOT NULL,content_type TEXT NOT NULL DEFAULT 'application/octet-stream',metadata_json TEXT NOT NULL DEFAULT '{}',created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ecu_artifact_chunks (object_key TEXT NOT NULL,chunk_index INTEGER NOT NULL,data BLOB NOT NULL,PRIMARY KEY(object_key,chunk_index),FOREIGN KEY(object_key) REFERENCES ecu_artifact_objects(object_key) ON DELETE CASCADE);
