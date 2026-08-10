-- Boarding fee financial records (audit-friendly; complements student_ledger)
-- tenant_id = school in ScholarNerve multi-tenant model

CREATE TABLE IF NOT EXISTS student_fee_records (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  fee_category VARCHAR(50) NOT NULL DEFAULT 'boarding',
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  is_voided BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_fee_records_tenant_student_term
  ON student_fee_records(tenant_id, student_id, term_id);

CREATE INDEX IF NOT EXISTS idx_student_fee_records_boarding_active
  ON student_fee_records(tenant_id, term_id, fee_category)
  WHERE source = 'boarding' AND is_voided = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_fee_records_boarding_line
  ON student_fee_records(tenant_id, student_id, term_id, fee_category)
  WHERE source = 'boarding' AND fee_category IN ('boarding_lodging', 'boarding_feeding');

CREATE TABLE IF NOT EXISTS boarding_fee_audit (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  term_id INTEGER REFERENCES terms(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  fee_amount NUMERIC(12, 2),
  triggered_by VARCHAR(50) NOT NULL,
  performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boarding_fee_audit_tenant ON boarding_fee_audit(tenant_id, created_at DESC);

-- Backfill boarding fee records from existing student_ledger boarding lines
INSERT INTO student_fee_records (
  tenant_id, student_id, term_id, fee_category, description, amount, source, payment_status, is_voided, metadata
)
SELECT
  sl.tenant_id,
  sl.student_id,
  sl.term_id,
  CASE WHEN sl.entry_type = 'boarding_feeding' THEN 'boarding_feeding' ELSE 'boarding_lodging' END,
  sl.description,
  sl.debit,
  'boarding',
  'unpaid',
  FALSE,
  COALESCE(sl.metadata, '{}'::jsonb)
FROM student_ledger sl
WHERE sl.entry_type IN ('boarding_fee', 'boarding_feeding')
  AND sl.debit > 0
  AND NOT EXISTS (
    SELECT 1 FROM student_fee_records sfr
    WHERE sfr.tenant_id = sl.tenant_id
      AND sfr.student_id = sl.student_id
      AND sfr.term_id = sl.term_id
      AND sfr.fee_category = CASE WHEN sl.entry_type = 'boarding_feeding' THEN 'boarding_feeding' ELSE 'boarding_lodging' END
      AND sfr.source = 'boarding'
  );

-- Mark voided where matching void entries exist on ledger
UPDATE student_fee_records sfr
SET is_voided = TRUE,
    payment_status = 'voided',
    updated_at = NOW()
FROM student_ledger sl_void
WHERE sfr.source = 'boarding'
  AND sfr.is_voided = FALSE
  AND sl_void.tenant_id = sfr.tenant_id
  AND sl_void.student_id = sfr.student_id
  AND sl_void.term_id = sfr.term_id
  AND (
    (sfr.fee_category = 'boarding_lodging' AND sl_void.entry_type = 'boarding_fee_void')
    OR (sfr.fee_category = 'boarding_feeding' AND sl_void.entry_type = 'boarding_feeding_void')
  );
