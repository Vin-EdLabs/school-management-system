-- Restore real staff names for payroll history after legacy scrub to [Removed]

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
