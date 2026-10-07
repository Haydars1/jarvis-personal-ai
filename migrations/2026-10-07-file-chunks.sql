-- Chunked file storage for files > 1.5MB (D1 row limit ~2MB)
CREATE TABLE IF NOT EXISTS file_chunks (
  key TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (key, chunk_index)
);
-- Add total_chunks column to files table (0 = data inline, >0 = chunked)
ALTER TABLE files ADD COLUMN total_chunks INTEGER NOT NULL DEFAULT 0;
