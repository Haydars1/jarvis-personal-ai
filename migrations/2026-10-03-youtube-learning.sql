CREATE TABLE IF NOT EXISTS learning_sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL DEFAULT 'youtube-video',
  source_url TEXT NOT NULL UNIQUE,
  external_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  language TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  parent_source_id TEXT,
  job_id TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}',
  learned_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_learning_sources_status ON learning_sources(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_sources_external ON learning_sources(source_type, external_id);

CREATE TABLE IF NOT EXISTS learning_chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(source_id) REFERENCES learning_sources(id) ON DELETE CASCADE,
  UNIQUE(source_id, ordinal)
);
CREATE INDEX IF NOT EXISTS idx_learning_chunks_source ON learning_chunks(source_id, ordinal);
