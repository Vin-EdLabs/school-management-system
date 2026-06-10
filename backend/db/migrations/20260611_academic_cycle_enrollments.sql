-- End-of-year academic cycle: enrollments, year status, final classes, graduation records

ALTER TABLE academic_years
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

UPDATE academic_years SET status = 'closed' WHERE is_current = false AND status = 'active';
UPDATE academic_years SET status = 'active' WHERE is_current = true;

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS level_order INTEGER,
  ADD COLUMN IF NOT EXISTS is_final_class BOOLEAN NOT NULL DEFAULT false;

-- Derive level_order from level name where missing
UPDATE classes SET level_order = CASE lower(trim(level))
  WHEN 'crèche' THEN 0 WHEN 'creche' THEN 0
  WHEN 'nursery 1' THEN 1 WHEN 'nursery 2' THEN 2
  WHEN 'kg1' THEN 3 WHEN 'kg2' THEN 4
  WHEN 'primary 1' THEN 5 WHEN 'primary 2' THEN 6 WHEN 'primary 3' THEN 7
  WHEN 'primary 4' THEN 8 WHEN 'primary 5' THEN 9 WHEN 'primary 6' THEN 10
  WHEN 'jhs 1' THEN 11 WHEN 'jhs 2' THEN 12 WHEN 'jhs 3' THEN 13
  WHEN 'shs 1' THEN 14 WHEN 'shs 2' THEN 15 WHEN 'shs 3' THEN 16
  ELSE COALESCE(level_order, 999)
END
WHERE level_order IS NULL;

UPDATE classes SET is_final_class = true
WHERE lower(trim(level)) IN ('jhs 3', 'shs 3', 'primary 6')
  AND is_final_class = false;

CREATE TABLE IF NOT EXISTS student_class_enrollments (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'promoted', 'repeated', 'graduated', 'transferred')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, student_id, academic_year_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_sce_tenant_year ON student_class_enrollments (tenant_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_sce_student ON student_class_enrollments (student_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_sce_class_year ON student_class_enrollments (class_id, academic_year_id);

CREATE TABLE IF NOT EXISTS graduation_details (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE SET NULL,
  academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  graduated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, student_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_graduation_tenant_year ON graduation_details (tenant_id, academic_year_id);

-- Backfill enrollments for current academic year from live class assignments
INSERT INTO student_class_enrollments (tenant_id, student_id, class_id, academic_year_id, status)
SELECT s.tenant_id, s.id, s.class_assigned_id, ay.id, 'active'
FROM students s
JOIN academic_years ay ON ay.tenant_id = s.tenant_id AND ay.is_current = true
WHERE s.class_assigned_id IS NOT NULL
  AND COALESCE(s.enrollment_status, 'active') = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM student_class_enrollments e
    WHERE e.tenant_id = s.tenant_id AND e.student_id = s.id AND e.academic_year_id = ay.id
  );
