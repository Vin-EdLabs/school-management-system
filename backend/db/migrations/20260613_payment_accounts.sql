-- Payment accounts for cash, bank, and mobile money tracking
CREATE TABLE IF NOT EXISTS payment_accounts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  account_type VARCHAR(50) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100),
  branch VARCHAR(255),
  network VARCHAR(100),
  phone_number VARCHAR(50),
  opening_balance NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_tenant ON payment_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_tenant_active ON payment_accounts(tenant_id, is_active);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_account_id INTEGER REFERENCES payment_accounts(id);
ALTER TABLE income ADD COLUMN IF NOT EXISTS payment_account_id INTEGER REFERENCES payment_accounts(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_account_id INTEGER REFERENCES payment_accounts(id);

CREATE INDEX IF NOT EXISTS idx_payments_payment_account ON payments(payment_account_id);
CREATE INDEX IF NOT EXISTS idx_income_payment_account ON income(payment_account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_account ON expenses(payment_account_id);

-- Default Cash at Hand account for every existing tenant
INSERT INTO payment_accounts (tenant_id, account_type, account_name, opening_balance, is_active, is_default)
SELECT t.id, 'cash', 'Cash at Hand', 0, true, true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM payment_accounts pa
  WHERE pa.tenant_id = t.id AND pa.account_type = 'cash' AND pa.is_active = true
);
