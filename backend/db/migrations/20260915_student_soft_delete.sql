-- Student soft delete: mirrors the teacher soft-delete pattern (superadmin-recoverable).
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS deletion_reason TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS pre_delete_enrollment_status VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_students_is_deleted ON students (tenant_id, is_deleted);
