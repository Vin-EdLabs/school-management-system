-- Platform Paystack keys + tenant fee bearer / super-admin gate

ALTER TABLE tenant_paystack_config
  ADD COLUMN IF NOT EXISTS fee_bearer VARCHAR(20) NOT NULL DEFAULT 'parent',
  ADD COLUMN IF NOT EXISTS super_admin_enabled BOOLEAN NOT NULL DEFAULT false;

UPDATE tenant_paystack_config SET fee_bearer = 'parent' WHERE fee_bearer IS NULL OR fee_bearer = '';

INSERT INTO platform_settings (key, value)
VALUES ('paystack', '{"useLiveKeys":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
