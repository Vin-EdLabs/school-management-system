-- Tag payments as term_fee vs daily_fee so finance statements and balances stay correct.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_category VARCHAR(20) DEFAULT 'term_fee';

UPDATE payments
SET payment_category = 'daily_fee'
WHERE payment_category IS DISTINCT FROM 'daily_fee'
  AND (
    notes ILIKE 'Daily Fee%'
    OR EXISTS (
      SELECT 1 FROM daily_fee_payments dfp
      WHERE dfp.tenant_id = payments.tenant_id
        AND dfp.student_id = payments.student_id
        AND dfp.payment_date = payments.payment_date::date
        AND dfp.amount_paid = payments.amount
    )
  );

UPDATE payments SET payment_category = 'term_fee' WHERE payment_category IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_category ON payments(tenant_id, student_id, payment_category);
