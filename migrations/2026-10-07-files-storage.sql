-- D1-based file storage (replaces R2 for free tier)
CREATE TABLE IF NOT EXISTS files (
  key TEXT PRIMARY KEY,
  data BLOB NOT NULL,
  content_type TEXT DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at);
