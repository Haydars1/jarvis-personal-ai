-- ECU Kalibrasyon Tanım Tablosu
-- A2L / XDF dosyalarından import edilen CHARACTERISTIC / TABLE / CONSTANT tanımları
-- scanRegions() tier 0.5 entegrasyonu için kullanılır

CREATE TABLE IF NOT EXISTS ecu_definitions (
  id TEXT PRIMARY KEY,
  def_set_id TEXT NOT NULL,           -- aynı dosyadan import edilen tanımları gruplar
  name TEXT NOT NULL,                 -- parametre adı (CHARACTERISTIC name / XDF title)
  description TEXT DEFAULT '',
  display_id TEXT DEFAULT '',
  address INTEGER NOT NULL,           -- base-offset düzeltmeli binary offset
  raw_address INTEGER,                -- orijinal A2L/XDF adresi
  datatype TEXT DEFAULT 'UWORD',      -- UBYTE, UWORD, SWORD, ULONG, FLOAT32_IEEE vb.
  data_size INTEGER DEFAULT 2,        -- byte cinsinden veri boyutu
  type TEXT DEFAULT 'scalar',         -- scalar, curve, map, array
  system TEXT,                        -- EGR, DPF, AdBlue/SCR, Lambda, Boost vb.
  unit TEXT DEFAULT '',
  math TEXT DEFAULT 'X',              -- dönüşüm denklemi
  lower_limit REAL,
  upper_limit REAL,
  axes TEXT DEFAULT '[]',             -- JSON array: [{name, address, length, datatype, unit, math}]
  element_count INTEGER DEFAULT 1,
  total_bytes INTEGER DEFAULT 2,
  source TEXT NOT NULL DEFAULT 'a2l', -- 'a2l' veya 'xdf'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Import set'leri — dosya bazlı gruplandırma ve metadata
CREATE TABLE IF NOT EXISTS ecu_definition_sets (
  id TEXT PRIMARY KEY,
  user_id TEXT,                       -- opsiyonel kullanıcı kimliği
  filename TEXT NOT NULL,
  format TEXT NOT NULL,               -- 'a2l' veya 'xdf'
  ecu_family TEXT,                    -- 'EDC17', 'MED17', 'ME7' vb.
  base_offset INTEGER DEFAULT 0,
  definition_count INTEGER DEFAULT 0,
  meta TEXT DEFAULT '{}',             -- JSON: project, module, title vb. parser meta
  tags TEXT DEFAULT '[]',             -- JSON array: kullanıcı etiketleri
  notes TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Performans indeksleri
CREATE INDEX IF NOT EXISTS idx_ecu_def_set ON ecu_definitions(def_set_id);
CREATE INDEX IF NOT EXISTS idx_ecu_def_name ON ecu_definitions(name);
CREATE INDEX IF NOT EXISTS idx_ecu_def_system ON ecu_definitions(system);
CREATE INDEX IF NOT EXISTS idx_ecu_def_address ON ecu_definitions(address);
CREATE INDEX IF NOT EXISTS idx_ecu_def_source ON ecu_definitions(source);
CREATE INDEX IF NOT EXISTS idx_ecu_def_type ON ecu_definitions(type);

CREATE INDEX IF NOT EXISTS idx_ecu_defset_family ON ecu_definition_sets(ecu_family);
CREATE INDEX IF NOT EXISTS idx_ecu_defset_format ON ecu_definition_sets(format);
CREATE INDEX IF NOT EXISTS idx_ecu_defset_created ON ecu_definition_sets(created_at);
