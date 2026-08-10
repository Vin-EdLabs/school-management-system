-- Term-level boarding fee (separate from class fee structures)

CREATE TABLE IF NOT EXISTS boarding_term_fees (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (tenant_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_boarding_term_fees_tenant_term ON boarding_term_fees(tenant_id, term_id);
