PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ai_active' CHECK (status IN ('ai_active','human_active','waiting','closed')),
  revision INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'de' CHECK (language IN ('de','tr','en')),
  page_path TEXT,
  fault_code TEXT,
  vehicle_json TEXT,
  raw_vehicle_text TEXT,
  visitor_session_id TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  preferred_contact TEXT,
  assigned_to TEXT,
  ai_resume_enabled INTEGER NOT NULL DEFAULT 1 CHECK (ai_resume_enabled IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_visitor ON conversations(visitor_session_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('visitor','ai','owner','system')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  idempotency_key TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_idempotency
  ON messages(conversation_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS notification_milestones (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (conversation_id, milestone)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  disabled_at TEXT
);
