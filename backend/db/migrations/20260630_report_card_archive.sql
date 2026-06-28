-- Permanent immutable report card snapshots when released to parents
CREATE TABLE IF NOT EXISTS report_card_archive (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  academic_year VARCHAR(50) NOT NULL,
  term VARCHAR(150) NOT NULL,
  class_name VARCHAR(255),
  student_admission_number VARCHAR(100),
  student_first_name VARCHAR(255),
  student_last_name VARCHAR(255),
  snapshot_json JSONB NOT NULL,
  grades_snapshot JSONB,
  remarks_snapshot JSONB,
  signatures_snapshot JSONB,
  html_snapshot TEXT,
  position INTEGER,
  percentage NUMERIC(6, 2),
  grand_total NUMERIC(10, 2),
  released_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, student_id, term, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_report_card_archive_student
  ON report_card_archive (tenant_id, student_id, academic_year DESC, term);

CREATE INDEX IF NOT EXISTS idx_report_card_archive_class_term
  ON report_card_archive (tenant_id, class_id, term, academic_year);
