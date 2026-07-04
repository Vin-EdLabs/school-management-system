-- Teacher removal tracking (soft/hard scrub) + other_staff headcount flag

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS deletion_type VARCHAR(10) CHECK (deletion_type IN ('soft', 'hard'));
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS removed_original_name VARCHAR(255);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS removed_original_staff_id VARCHAR(50);

ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS counts_as_staff BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS deletion_type VARCHAR(10) CHECK (deletion_type IN ('soft', 'hard'));
ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS removed_original_name VARCHAR(255);
ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS removed_original_staff_id VARCHAR(50);

-- Backfill legacy soft-deleted teachers
UPDATE teachers
SET deleted_at = COALESCE(updated_at, created_at, NOW()),
    deletion_type = 'soft'
WHERE COALESCE(is_deleted, false) = true
  AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_teachers_deleted_at ON teachers (tenant_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_teachers_deletion_type ON teachers (tenant_id, deletion_type) WHERE deletion_type IS NOT NULL;

-- Restore real names in payment history for rows scrubbed before name preservation
UPDATE teachers
SET full_name = removed_original_name
WHERE TRIM(COALESCE(full_name, '')) = '[Removed]'
  AND removed_original_name IS NOT NULL
  AND TRIM(removed_original_name) <> '';

UPDATE other_staff
SET full_name = removed_original_name
WHERE TRIM(COALESCE(full_name, '')) = '[Removed]'
  AND removed_original_name IS NOT NULL
  AND TRIM(removed_original_name) <> '';

-- Recover names from linked salary expense records (legacy scrub before name preservation)
UPDATE teachers t
SET removed_original_name = COALESCE(t.removed_original_name, sub.payee_name),
    full_name = CASE
      WHEN TRIM(COALESCE(t.full_name, '')) = '[Removed]' THEN sub.payee_name
      ELSE t.full_name
    END
FROM (
  SELECT DISTINCT ON (sp.tenant_id, sp.payee_id)
    sp.tenant_id, sp.payee_id, e.payee_name
  FROM salary_payments sp
  JOIN expenses e ON e.id = sp.expense_id AND e.tenant_id = sp.tenant_id
  WHERE sp.payee_type = 'teacher'
    AND e.payee_name IS NOT NULL
    AND TRIM(e.payee_name) <> ''
    AND TRIM(e.payee_name) <> '[Removed]'
  ORDER BY sp.tenant_id, sp.payee_id, sp.year DESC, sp.month DESC
) sub
WHERE t.id = sub.payee_id
  AND t.tenant_id = sub.tenant_id
  AND (
    TRIM(COALESCE(t.full_name, '')) = '[Removed]'
    OR t.removed_original_name IS NULL
    OR TRIM(t.removed_original_name) = ''
  );

UPDATE other_staff o
SET removed_original_name = COALESCE(o.removed_original_name, sub.payee_name),
    full_name = CASE
      WHEN TRIM(COALESCE(o.full_name, '')) = '[Removed]' THEN sub.payee_name
      ELSE o.full_name
    END
FROM (
  SELECT DISTINCT ON (sp.tenant_id, sp.payee_id)
    sp.tenant_id, sp.payee_id, e.payee_name
  FROM salary_payments sp
  JOIN expenses e ON e.id = sp.expense_id AND e.tenant_id = sp.tenant_id
  WHERE sp.payee_type = 'staff'
    AND e.payee_name IS NOT NULL
    AND TRIM(e.payee_name) <> ''
    AND TRIM(e.payee_name) <> '[Removed]'
  ORDER BY sp.tenant_id, sp.payee_id, sp.year DESC, sp.month DESC
) sub
WHERE o.id = sub.payee_id
  AND o.tenant_id = sub.tenant_id
  AND (
    TRIM(COALESCE(o.full_name, '')) = '[Removed]'
    OR o.removed_original_name IS NULL
    OR TRIM(o.removed_original_name) = ''
  );
