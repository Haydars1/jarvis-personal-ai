-- OBD-II Bridge: session logging and live readings
CREATE TABLE IF NOT EXISTS obd_sessions (
  id TEXT PRIMARY KEY,
  vehicle_info TEXT DEFAULT '{}',
  protocol TEXT DEFAULT 'auto',
  status TEXT DEFAULT 'active',
  started_at INTEGER,
  ended_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS obd_readings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  pid TEXT NOT NULL,
  name TEXT DEFAULT '',
  value TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  raw_hex TEXT DEFAULT '',
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_obd_readings_session ON obd_readings(session_id);
CREATE INDEX IF NOT EXISTS idx_obd_readings_pid ON obd_readings(pid);
CREATE INDEX IF NOT EXISTS idx_obd_sessions_status ON obd_sessions(status);
