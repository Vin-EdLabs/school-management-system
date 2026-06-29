-- School payment receiving details (shown to parents when making payments)
CREATE TABLE IF NOT EXISTS school_payment_settings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  mtn_momo_number VARCHAR(50),
  vodafone_cash_number VARCHAR(50),
  airteltigo_number VARCHAR(50),
  merchant_id VARCHAR(100),
  bank_name VARCHAR(255),
  bank_account_number VARCHAR(100),
  bank_account_name VARCHAR(255),
  payment_instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parent-submitted payment proofs for finance review
CREATE TABLE IF NOT EXISTS payment_submissions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_user_id INTEGER NOT NULL REFERENCES parent_portal_accounts(id) ON DELETE CASCADE,
  amount_claimed DECIMAL(12, 2) NOT NULL,
  network_used VARCHAR(50) NOT NULL,
  transaction_reference VARCHAR(255),
  screenshot_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'rejected')),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_tenant_status
  ON payment_submissions (tenant_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_parent
  ON payment_submissions (parent_user_id, submitted_at DESC);
