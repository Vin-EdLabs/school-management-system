-- Optional SSNIT amount recorded for display when SSNIT toggle is off (not deducted from net).
ALTER TABLE salary_payments
  ADD COLUMN IF NOT EXISTS ssnit_manual_amount NUMERIC(10, 2) DEFAULT NULL;
