-- Scope grade assignments to academic term/year so new terms start fresh
ALTER TABLE grade_assignments ADD COLUMN IF NOT EXISTS term VARCHAR(150);
ALTER TABLE grade_assignments ADD COLUMN IF NOT EXISTS academic_year VARCHAR(50);

UPDATE grade_assignments ga
SET
  term = COALESCE(NULLIF(TRIM(ga.term), ''), ss.current_term),
  academic_year = COALESCE(NULLIF(TRIM(ga.academic_year), ''), ss.current_year)
FROM school_settings ss
WHERE ga.tenant_id = ss.tenant_id
  AND (ga.term IS NULL OR TRIM(ga.term) = '' OR ga.academic_year IS NULL OR TRIM(ga.academic_year) = '');

CREATE INDEX IF NOT EXISTS idx_grade_assignments_term
  ON grade_assignments (tenant_id, class_id, term, academic_year);
