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

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'api_key',
  encrypted_secret TEXT NOT NULL,
  capabilities TEXT NOT NULL DEFAULT '[]',
  endpoint TEXT,
  model TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  meta TEXT NOT NULL DEFAULT '{}',
  last_status TEXT NOT NULL DEFAULT 'untested',
  last_error TEXT,
  last_test_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_credentials_enabled ON credentials(enabled, priority);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  step INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  result TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS change_requests (
  id TEXT PRIMARY KEY,
  request TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'queued',
  provider TEXT,
  repo TEXT,
  branch TEXT,
  pr_url TEXT,
  summary TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_change_requests_created ON change_requests(created_at DESC);
CREATE TABLE IF NOT EXISTS runtime_errors (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  context TEXT,
  message TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_runtime_errors_fp ON runtime_errors(fingerprint,resolved,ts DESC);


CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT NOT NULL DEFAULT '[]',
  device_type TEXT,
  backed_up INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_passkeys_created ON passkeys(created_at DESC);


CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  provider TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
