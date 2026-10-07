-- Not Defteri tablosu
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT DEFAULT '',
  content TEXT NOT NULL,
  category TEXT DEFAULT 'genel',
  pinned INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned DESC, updated_at DESC);

-- Yapılacaklar tablosu
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  done INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'normal',
  due_date TEXT DEFAULT '',
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_todos_done ON todos(done, priority);
CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_date);
