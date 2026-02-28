-- ==========================================================================
-- Migration: Remove meta columns from all tables.
--            Replace subjects_taught array with teacher_subjects join table.
-- ==========================================================================

-- 1. Create proper teacher_subjects relationship table
CREATE TABLE IF NOT EXISTS teacher_subjects (
  teacher_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, subject_id)
);

-- 2. Migrate existing subjects_taught text[] column -> teacher_subjects rows
--    (match by subject name, case-insensitive)
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT u.id, s.id
FROM users u
CROSS JOIN LATERAL unnest(u.subjects_taught) AS st(subject_name)
JOIN subjects s ON lower(s.name) = lower(st.subject_name)
WHERE u.role = 'teacher'
  AND u.subjects_taught IS NOT NULL
  AND array_length(u.subjects_taught, 1) > 0
ON CONFLICT DO NOTHING;

-- 3. Drop subjects_taught array column from users (replaced by teacher_subjects)
ALTER TABLE users DROP COLUMN IF EXISTS subjects_taught;

-- 4. Drop meta from all tables
ALTER TABLE users          DROP COLUMN IF EXISTS meta;
ALTER TABLE classes        DROP COLUMN IF EXISTS meta;
ALTER TABLE students       DROP COLUMN IF EXISTS meta;
ALTER TABLE subjects       DROP COLUMN IF EXISTS meta;
ALTER TABLE guardians      DROP COLUMN IF EXISTS meta;
ALTER TABLE events         DROP COLUMN IF EXISTS meta;
ALTER TABLE expenses       DROP COLUMN IF EXISTS meta;
ALTER TABLE fee_items      DROP COLUMN IF EXISTS meta;
ALTER TABLE income         DROP COLUMN IF EXISTS meta;
ALTER TABLE invoices       DROP COLUMN IF EXISTS meta;
ALTER TABLE payments       DROP COLUMN IF EXISTS meta;
ALTER TABLE notifications  DROP COLUMN IF EXISTS meta;
ALTER TABLE academic_terms DROP COLUMN IF EXISTS meta;
ALTER TABLE academic_years DROP COLUMN IF EXISTS meta;
ALTER TABLE audit_log      DROP COLUMN IF EXISTS meta;
ALTER TABLE audit_logs     DROP COLUMN IF EXISTS meta;
