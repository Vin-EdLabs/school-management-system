-- Online payments via Paystack (ScholarNerve merchant or school's own account)

CREATE TABLE IF NOT EXISTS tenant_paystack_config (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL DEFAULT 'scholarnerve' CHECK (mode IN ('scholarnerve', 'own')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  subaccount_code VARCHAR(80),
  payout_account VARCHAR(120),
  own_secret_key_encrypted TEXT,
  own_public_key VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_paystack_config_tenant ON tenant_paystack_config(tenant_id);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reference VARCHAR(80) NOT NULL UNIQUE,
  amount_kobo INTEGER NOT NULL,
  fee_kobo INTEGER NOT NULL DEFAULT 0,
  total_kobo INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'abandoned')),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('scholarnerve', 'own')),
  paystack_id VARCHAR(80),
  payment_channel VARCHAR(40),
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant ON payment_transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_student ON payment_transactions(tenant_id, student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(tenant_id, status);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_transaction_id INTEGER REFERENCES payment_transactions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_payment_transaction ON payments(payment_transaction_id);
