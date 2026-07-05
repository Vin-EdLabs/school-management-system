-- Grade configuration overhaul (additive — grade_assignments = assessments, student_grades = scores)

CREATE TABLE IF NOT EXISTS grade_configs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_score_weight NUMERIC(5,2) NOT NULL DEFAULT 50,
  exam_weight NUMERIC(5,2) NOT NULL DEFAULT 50,
  CONSTRAINT grade_configs_weights_sum_100 CHECK (
    ROUND(class_score_weight + exam_weight, 2) = 100.00
  ),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

CREATE TABLE IF NOT EXISTS grade_config_components (
  id SERIAL PRIMARY KEY,
  grade_config_id INTEGER NOT NULL REFERENCES grade_configs(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  weight_in_class_score NUMERIC(5,2) NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grade_boundaries (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  grade_label VARCHAR(10) NOT NULL,
  min_percent NUMERIC(5,2) NOT NULL,
  max_percent NUMERIC(5,2) NOT NULL,
  remark VARCHAR(50),
  display_order INTEGER DEFAULT 0
);

-- Extend grade_assignments (assessments)
ALTER TABLE grade_assignments ADD COLUMN IF NOT EXISTS component_id INTEGER REFERENCES grade_config_components(id) ON DELETE SET NULL;
ALTER TABLE grade_assignments ADD COLUMN IF NOT EXISTS is_exam BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE grade_assignments ADD COLUMN IF NOT EXISTS max_marks NUMERIC(8,2);
ALTER TABLE grade_assignments ADD COLUMN IF NOT EXISTS subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL;
ALTER TABLE grade_assignments ADD COLUMN IF NOT EXISTS academic_term_id INTEGER REFERENCES academic_terms(id) ON DELETE SET NULL;
ALTER TABLE grade_assignments ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

UPDATE grade_assignments SET max_marks = max_score WHERE max_marks IS NULL;
UPDATE grade_assignments SET is_exam = TRUE
  WHERE LOWER(COALESCE(assignment_type, '')) = 'exam'
     OR LOWER(COALESCE(name, '')) LIKE '%exam%';
UPDATE grade_assignments SET is_exam = COALESCE(is_exam, FALSE);

-- Extend student_grades
ALTER TABLE student_grades ADD COLUMN IF NOT EXISTS raw_score NUMERIC(8,2);
UPDATE student_grades SET raw_score = score WHERE raw_score IS NULL;

-- Dedupe legacy exams before partial unique index
UPDATE grade_assignments ga
SET is_exam = FALSE
WHERE is_exam = TRUE
  AND id NOT IN (
    SELECT MIN(id)
    FROM grade_assignments
    WHERE is_exam = TRUE
    GROUP BY tenant_id, class_id, subject, term, academic_year
  );

-- One exam per subject/class/term
CREATE UNIQUE INDEX IF NOT EXISTS one_exam_per_subject_per_term
  ON grade_assignments (tenant_id, class_id, subject, term, academic_year)
  WHERE is_exam = TRUE;

-- Grade config snapshot on term close (finance term_snapshots + academic terms)
ALTER TABLE term_snapshots ADD COLUMN IF NOT EXISTS grade_config_snapshot JSONB;
ALTER TABLE academic_terms ADD COLUMN IF NOT EXISTS grade_config_snapshot JSONB;

-- Seed default grade config for existing tenants
INSERT INTO grade_configs (tenant_id, class_score_weight, exam_weight)
SELECT id, 50, 50 FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM grade_configs)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO grade_config_components (grade_config_id, tenant_id, name, weight_in_class_score, display_order)
SELECT gc.id, gc.tenant_id, comp.name, 25, comp.ord
FROM grade_configs gc
CROSS JOIN (VALUES
  ('Individual Test', 1),
  ('Group Test', 2),
  ('Class Test', 3),
  ('Project', 4)
) AS comp(name, ord)
WHERE gc.tenant_id NOT IN (
  SELECT DISTINCT tenant_id FROM grade_config_components
);

INSERT INTO grade_boundaries (tenant_id, grade_label, min_percent, max_percent, remark, display_order)
SELECT t.id, b.grade_label, b.min_p, b.max_p, b.remark, b.ord
FROM tenants t
CROSS JOIN (VALUES
  ('A1', 80, 100, 'Excellent', 1),
  ('B2', 70, 79,  'Very Good', 2),
  ('B3', 60, 69,  'Good', 3),
  ('C4', 55, 59,  'Credit', 4),
  ('C5', 50, 54,  'Credit', 5),
  ('C6', 45, 49,  'Credit', 6),
  ('D7', 40, 44,  'Pass', 7),
  ('E8', 35, 39,  'Pass', 8),
  ('F9', 0,  34,  'Fail', 9)
) AS b(grade_label, min_p, max_p, remark, ord)
WHERE t.id NOT IN (
  SELECT DISTINCT tenant_id FROM grade_boundaries
);
