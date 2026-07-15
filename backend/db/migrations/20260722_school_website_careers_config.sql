-- Careers / employment application settings per tenant
CREATE TABLE IF NOT EXISTS school_website_careers_config (
  tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  applications_open BOOLEAN NOT NULL DEFAULT true,
  intro_text TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
