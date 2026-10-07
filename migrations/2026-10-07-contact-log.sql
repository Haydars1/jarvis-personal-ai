-- Müşteri İletişim Kaydı
CREATE TABLE IF NOT EXISTS contact_log (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  channel TEXT DEFAULT 'whatsapp',
  direction TEXT DEFAULT 'outgoing',
  summary TEXT NOT NULL,
  created_at INTEGER,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_contact_log_customer ON contact_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_contact_log_date ON contact_log(created_at);
