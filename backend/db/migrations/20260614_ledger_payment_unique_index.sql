-- Add unique index to prevent duplicate student_ledger entries for the same payment and portion
-- Coalesce portion to empty string so NULLs are treated uniformly
CREATE UNIQUE INDEX IF NOT EXISTS uniq_student_ledger_payment_portion
  ON student_ledger (payment_id, (COALESCE(metadata->>'portion', '')))
  WHERE payment_id IS NOT NULL;
