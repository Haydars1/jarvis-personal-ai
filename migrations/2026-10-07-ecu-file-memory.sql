-- ECU Dosya Hafıza Sistemi
-- Yüklenen dosyaları hash ile tanır, metadata saklar, arama ve hızlı modifiye sağlar

CREATE TABLE IF NOT EXISTS ecu_file_memory (
  id TEXT PRIMARY KEY,
  file_hash TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  ecu_type TEXT,
  fuel_type TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year TEXT,
  detected_systems TEXT NOT NULL DEFAULT '[]',
  ecu_profile_data TEXT,
  scan_result_summary TEXT,
  tags TEXT DEFAULT '[]',
  notes TEXT DEFAULT '',
  times_uploaded INTEGER DEFAULT 1,
  last_modifications TEXT DEFAULT '[]',
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  upload_ids TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_ecu_memory_hash ON ecu_file_memory(file_hash);
CREATE INDEX IF NOT EXISTS idx_ecu_memory_ecu ON ecu_file_memory(ecu_type);
CREATE INDEX IF NOT EXISTS idx_ecu_memory_fuel ON ecu_file_memory(fuel_type);
CREATE INDEX IF NOT EXISTS idx_ecu_memory_make ON ecu_file_memory(vehicle_make);
CREATE INDEX IF NOT EXISTS idx_ecu_memory_model ON ecu_file_memory(vehicle_model);
CREATE INDEX IF NOT EXISTS idx_ecu_memory_lastseen ON ecu_file_memory(last_seen_at);
