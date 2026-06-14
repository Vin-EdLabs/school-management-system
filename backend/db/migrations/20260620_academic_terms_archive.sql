ALTER TABLE academic_terms ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
UPDATE academic_terms SET is_archived = false WHERE is_archived IS NULL;
CREATE INDEX IF NOT EXISTS idx_academic_terms_tenant_archived ON academic_terms(tenant_id, is_archived);
