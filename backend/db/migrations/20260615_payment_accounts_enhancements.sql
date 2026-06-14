-- Payment account opening balance tracking
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS opening_balance_as_of DATE;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS opening_balance_configured BOOLEAN DEFAULT false;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);

-- Legacy migration flag (one-time per tenant)
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS legacy_payment_migration_completed BOOLEAN DEFAULT false;

-- Fund transfers between accounts
CREATE TABLE IF NOT EXISTS fund_transfers (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_account_id INTEGER NOT NULL REFERENCES payment_accounts(id),
  to_account_id INTEGER NOT NULL REFERENCES payment_accounts(id),
  amount NUMERIC(10,2) NOT NULL,
  transfer_date DATE NOT NULL,
  note TEXT NOT NULL,
  transferred_by INTEGER REFERENCES users(id),
  is_reversed BOOLEAN DEFAULT false,
  reversed_by INTEGER REFERENCES users(id),
  reversed_at TIMESTAMP,
  original_transfer_id INTEGER REFERENCES fund_transfers(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fund_transfers_tenant ON fund_transfers(tenant_id, transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_from ON fund_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_to ON fund_transfers(to_account_id);

-- Existing auto-seeded cash accounts with no configuration: allow admin to set opening balance
UPDATE payment_accounts pa
SET opening_balance_configured = false,
    opening_balance_as_of = COALESCE(opening_balance_as_of, CURRENT_DATE)
WHERE pa.account_type = 'cash'
  AND COALESCE(pa.opening_balance_configured, false) = false;
