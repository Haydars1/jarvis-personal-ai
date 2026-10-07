-- CRM tables: customers, jobs, invoices
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  vehicle TEXT DEFAULT '',
  plate TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  type TEXT DEFAULT 'tuning',
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  price REAL DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  files TEXT DEFAULT '[]',
  notes TEXT DEFAULT '',
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  job_id TEXT,
  number TEXT NOT NULL,
  html TEXT DEFAULT '',
  total REAL DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  status TEXT DEFAULT 'draft',
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(number);
