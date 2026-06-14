-- Receipt correction support on payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_account_id INTEGER REFERENCES payment_accounts(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_voided BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS base_receipt_number VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_version INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS correction_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS corrected_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS corrects_payment_id INTEGER REFERENCES payments(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS corrected_by_payment_id INTEGER REFERENCES payments(id);

UPDATE payments
SET base_receipt_number = receipt_number
WHERE base_receipt_number IS NULL AND receipt_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_voided ON payments(tenant_id, is_voided);
CREATE INDEX IF NOT EXISTS idx_payments_locked ON payments(tenant_id, is_locked);
CREATE INDEX IF NOT EXISTS idx_payments_corrects ON payments(corrects_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_base_receipt ON payments(tenant_id, base_receipt_number);

CREATE TABLE IF NOT EXISTS receipt_corrections (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_payment_id INTEGER NOT NULL REFERENCES payments(id),
  corrected_payment_id INTEGER NOT NULL REFERENCES payments(id),
  corrected_by_user_id INTEGER REFERENCES users(id),
  correction_reason TEXT NOT NULL,
  before_values JSONB NOT NULL,
  after_values JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_receipt_corrections_tenant ON receipt_corrections(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_corrections_user ON receipt_corrections(corrected_by_user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_corrections_original ON receipt_corrections(original_payment_id);

-- Lock receipts older than 7 days (one-time backfill for existing rows)
UPDATE payments
SET is_locked = true, locked_at = COALESCE(locked_at, CURRENT_TIMESTAMP)
WHERE COALESCE(is_locked, false) = false
  AND COALESCE(is_voided, false) = false
  AND created_at < (CURRENT_TIMESTAMP - INTERVAL '7 days');
