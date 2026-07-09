-- Soft-archive tenants (hidden from login; restorable by super-admin)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS archived_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_archived_at ON tenants (archived_at) WHERE archived_at IS NOT NULL;
