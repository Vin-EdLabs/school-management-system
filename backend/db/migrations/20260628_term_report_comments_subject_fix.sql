-- NULL subject breaks UNIQUE upsert in PostgreSQL (each NULL is distinct).
UPDATE term_report_comments SET subject = '' WHERE subject IS NULL;

DELETE FROM term_report_comments a
USING term_report_comments b
WHERE a.id < b.id
  AND a.tenant_id = b.tenant_id
  AND a.student_id = b.student_id
  AND a.class_id = b.class_id
  AND a.term = b.term
  AND a.academic_year = b.academic_year
  AND COALESCE(a.subject, '') = COALESCE(b.subject, '')
  AND a.remark_type = b.remark_type;
