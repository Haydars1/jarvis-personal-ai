-- Randevu / Termin tablosu
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT DEFAULT '10:00',
  status TEXT DEFAULT 'scheduled',
  notes TEXT DEFAULT '',
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
