-- Parent portal family groups: lets admins link sibling students so parents can switch without re-login.

CREATE TABLE IF NOT EXISTS parent_portal_family_groups (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parent_portal_family_groups_tenant
  ON parent_portal_family_groups (tenant_id);

ALTER TABLE parent_portal_accounts
  ADD COLUMN IF NOT EXISTS family_group_id INTEGER REFERENCES parent_portal_family_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parent_portal_accounts_family_group
  ON parent_portal_accounts (tenant_id, family_group_id);
