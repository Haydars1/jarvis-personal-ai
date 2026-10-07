-- Chunked file storage for files > 1.5MB (D1 row limit ~2MB)
CREATE TABLE IF NOT EXISTS file_chunks (
  key TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (key, chunk_index)
);
-- Recreate files table with total_chunks column (SQLite has no ADD COLUMN IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS files_v2 (
  key TEXT PRIMARY KEY,
  data BLOB NOT NULL,
  content_type TEXT DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO files_v2(key,data,content_type,size,total_chunks,created_at)
  SELECT key,data,content_type,size,0,created_at FROM files WHERE TRUE;
DROP TABLE IF EXISTS files;
ALTER TABLE files_v2 RENAME TO files;
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at);
