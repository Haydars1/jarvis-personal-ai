-- ThinkDiag TC Recording Import
-- Stores parsed .TC diagnostic recordings from ThinkDiag/ThinkScan/ThinkTool devices

CREATE TABLE IF NOT EXISTS thinkdiag_recordings (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL DEFAULT 'unknown.tc',
  file_size INTEGER NOT NULL DEFAULT 0,
  magic TEXT NOT NULL DEFAULT 'LSX8',
  language TEXT DEFAULT '',
  timestamp_str TEXT DEFAULT '',
  region TEXT DEFAULT '',
  version TEXT DEFAULT '',
  manufacturer TEXT DEFAULT '',
  device_id TEXT DEFAULT '',
  protocol TEXT DEFAULT '',
  tc_session_id TEXT DEFAULT '',
  parameter_count INTEGER NOT NULL DEFAULT 0,
  record_count INTEGER NOT NULL DEFAULT 0,
  string_count INTEGER NOT NULL DEFAULT 0,
  parameters_json TEXT NOT NULL DEFAULT '[]',
  units_json TEXT NOT NULL DEFAULT '[]',
  param_units_json TEXT NOT NULL DEFAULT '[]',
  linked_obd_session TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_thinkdiag_recordings_created ON thinkdiag_recordings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_thinkdiag_recordings_mfr ON thinkdiag_recordings(manufacturer, protocol);
CREATE INDEX IF NOT EXISTS idx_thinkdiag_recordings_obd ON thinkdiag_recordings(linked_obd_session);

CREATE TABLE IF NOT EXISTS thinkdiag_record_data (
  id TEXT PRIMARY KEY,
  recording_id TEXT NOT NULL,
  record_index INTEGER NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(recording_id) REFERENCES thinkdiag_recordings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_thinkdiag_record_data_rec ON thinkdiag_record_data(recording_id, record_index ASC);
