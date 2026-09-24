CREATE TABLE IF NOT EXISTS ecu_github_repositories (
  repository TEXT PRIMARY KEY,
  license TEXT NOT NULL DEFAULT 'unknown',
  reuse_policy TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
  stars INTEGER NOT NULL DEFAULT 0,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  default_branch TEXT NOT NULL DEFAULT '',
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ecu_github_repositories_reuse
ON ecu_github_repositories(reuse_policy, stars DESC, last_seen_at DESC);
