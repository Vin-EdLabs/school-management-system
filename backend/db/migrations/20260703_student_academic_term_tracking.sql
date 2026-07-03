-- Track admission and inactivation by academic term for accurate reports
ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_academic_term_id INTEGER REFERENCES academic_terms(id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS inactivated_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS inactivated_academic_term_id INTEGER REFERENCES academic_terms(id);

CREATE INDEX IF NOT EXISTS idx_students_admission_term ON students(tenant_id, admission_academic_term_id);
CREATE INDEX IF NOT EXISTS idx_students_inactivated_term ON students(tenant_id, inactivated_academic_term_id);
