-- Unified ledger: audit columns on student_ledger
ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS reference VARCHAR(255);
ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payments(id);
ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE student_ledger ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_student_ledger_payment_id ON student_ledger(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_ledger_student_term ON student_ledger(tenant_id, student_id, term_id);
