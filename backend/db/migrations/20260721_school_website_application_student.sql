-- Link accepted website admission applications to pending student records
ALTER TABLE school_website_applications
  ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_school_website_applications_student
  ON school_website_applications (tenant_id, student_id)
  WHERE student_id IS NOT NULL;
