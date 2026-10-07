-- Fiyat Listesi tablosu
CREATE TABLE IF NOT EXISTS price_list (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  currency TEXT DEFAULT 'EUR',
  category TEXT DEFAULT 'tuning',
  active INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_price_list_category ON price_list(category);

-- Gelir/Gider tablosu
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'income',
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'EUR',
  category TEXT DEFAULT 'genel',
  description TEXT DEFAULT '',
  date TEXT NOT NULL,
  customer_id TEXT DEFAULT '',
  job_id TEXT DEFAULT '',
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

-- Varsayılan fiyat listesi
INSERT OR IGNORE INTO price_list (id, service, description, price, currency, category, active, created_at, updated_at) VALUES
  ('p1', 'Stage 1 Tuning', 'ECU yazılım optimizasyonu — güç ve tork artışı', 350, 'EUR', 'tuning', 1, 0, 0),
  ('p2', 'EGR Off', 'EGR valf devre dışı bırakma', 150, 'EUR', 'tuning', 1, 0, 0),
  ('p3', 'DPF Off', 'DPF filtre devre dışı bırakma', 200, 'EUR', 'tuning', 1, 0, 0),
  ('p4', 'AdBlue Off', 'AdBlue sistem devre dışı bırakma', 200, 'EUR', 'tuning', 1, 0, 0),
  ('p5', 'Pop & Bang', 'Egzoz patlama efekti yazılımı', 150, 'EUR', 'tuning', 1, 0, 0),
  ('p6', 'DTC Silme', 'Arıza kodu silme (adet başı)', 50, 'EUR', 'tuning', 1, 0, 0),
  ('p7', 'Komple Paket', 'Stage 1 + EGR + DPF + AdBlue', 750, 'EUR', 'tuning', 1, 0, 0),
  ('p8', 'Diagnostik / Arıza Okuma', 'OBD arıza kodu okuma ve rapor', 30, 'EUR', 'diagnostik', 1, 0, 0),
  ('p9', 'Kodlama', 'Araç modül kodlama (gizli özellik açma)', 80, 'EUR', 'kodlama', 1, 0, 0),
  ('p10', 'Anahtar Kodlama', 'Yedek anahtar programlama', 120, 'EUR', 'kodlama', 1, 0, 0);
