-- Drop join table and restore teacher_id column (best-effort restore)
ALTER TABLE IF EXISTS classes ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
DROP TABLE IF EXISTS teacher_classes;
