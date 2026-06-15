-- Term close & snapshot
ALTER TABLE terms ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE terms ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
ALTER TABLE terms ADD COLUMN IF NOT EXISTS closed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE terms ADD COLUMN IF NOT EXISTS snapshot_completed_at TIMESTAMP;
UPDATE terms SET status = 'active' WHERE status IS NULL;

CREATE TABLE IF NOT EXISTS term_snapshots (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  term_id INTEGER REFERENCES terms(id) ON DELETE CASCADE,
  academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_students INTEGER,
  total_fees_billed NUMERIC(12, 2),
  total_collected NUMERIC(12, 2),
  total_outstanding NUMERIC(12, 2),
  total_credits NUMERIC(12, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_term_snapshots_tenant_term ON term_snapshots(tenant_id, term_id);
