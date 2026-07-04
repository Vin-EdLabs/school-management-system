-- Backfill inactivation term tracking for students marked inactive before columns existed
UPDATE students s
SET inactivated_at = COALESCE(s.inactivated_at, s.updated_at)
WHERE LOWER(COALESCE(s.enrollment_status, 'active')) = 'inactive'
  AND s.inactivated_at IS NULL
  AND s.updated_at IS NOT NULL;

UPDATE students s
SET inactivated_academic_term_id = picked.term_id
FROM (
  SELECT s2.id AS student_id,
         (
           SELECT at.id
           FROM academic_terms at
           WHERE at.tenant_id = s2.tenant_id
             AND COALESCE(s2.inactivated_at, s2.updated_at)::date
                 >= COALESCE(at.start_date, '1900-01-01'::date)
             AND COALESCE(s2.inactivated_at, s2.updated_at)::date
                 <= COALESCE(at.end_date, CURRENT_DATE)
           ORDER BY at.start_date DESC NULLS LAST, at.id DESC
           LIMIT 1
         ) AS term_id
  FROM students s2
  WHERE LOWER(COALESCE(s2.enrollment_status, 'active')) = 'inactive'
    AND s2.inactivated_academic_term_id IS NULL
    AND COALESCE(s2.inactivated_at, s2.updated_at) IS NOT NULL
) picked
WHERE s.id = picked.student_id
  AND picked.term_id IS NOT NULL;
