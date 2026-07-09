-- Archived fee structures captured when a term is closed (view + manual reuse only).
CREATE TABLE IF NOT EXISTS term_fee_structure_archives (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ledger_term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  term_label VARCHAR(200) NOT NULL,
  academic_year VARCHAR(50),
  structures JSONB NOT NULL DEFAULT '[]'::jsonb,
  structure_count INTEGER NOT NULL DEFAULT 0,
  term_snapshot_id INTEGER REFERENCES term_snapshots(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(tenant_id, ledger_term_id)
);

CREATE INDEX IF NOT EXISTS idx_term_fee_structure_archives_tenant
  ON term_fee_structure_archives(tenant_id, created_at DESC);
