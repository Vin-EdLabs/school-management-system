-- Assistant teachers (parent_teacher_id) + unified teacher status values

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS parent_teacher_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teachers_parent_teacher_id_fkey'
  ) THEN
    ALTER TABLE teachers
      ADD CONSTRAINT teachers_parent_teacher_id_fkey
      FOREIGN KEY (parent_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teachers_parent_teacher_id ON teachers (tenant_id, parent_teacher_id);

-- Ensure status column exists (added in 20260617 migration)
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Normalize legacy status values into: active | deactivated | soft_deleted | hard_deleted
UPDATE teachers SET status = 'active'
WHERE status IS NULL OR TRIM(status) = '';

UPDATE teachers SET status = 'deactivated'
WHERE LOWER(TRIM(status)) IN ('suspended', 'left', 'terminated', 'resigned')
   OR LOWER(COALESCE(employment_status, '')) IN ('left', 'deactivated', 'terminated', 'resigned', 'suspended');

UPDATE teachers SET status = 'soft_deleted'
WHERE (COALESCE(is_deleted, false) = true OR deleted_at IS NOT NULL)
  AND COALESCE(deletion_type, 'soft') = 'soft'
  AND COALESCE(status, '') NOT IN ('hard_deleted');

UPDATE teachers SET status = 'hard_deleted'
WHERE deleted_at IS NOT NULL AND deletion_type = 'hard';

UPDATE teachers SET status = 'deactivated'
WHERE status NOT IN ('active', 'deactivated', 'soft_deleted', 'hard_deleted');

-- Assistants under removed/deactivated parents become main teachers
UPDATE teachers SET parent_teacher_id = NULL
WHERE parent_teacher_id IS NOT NULL
  AND parent_teacher_id IN (
    SELECT id FROM teachers p
    WHERE COALESCE(p.status, 'active') IN ('deactivated', 'soft_deleted', 'hard_deleted')
       OR p.deleted_at IS NOT NULL
  );

-- Prevent self-reference
UPDATE teachers SET parent_teacher_id = NULL WHERE parent_teacher_id = id;
