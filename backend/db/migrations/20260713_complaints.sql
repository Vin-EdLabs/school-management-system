-- Complaints management (multi-tenant)

DO $$ BEGIN
  CREATE TYPE complaint_type AS ENUM ('student', 'teacher');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE complaint_severity AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE complaint_status AS ENUM ('pending', 'under_review', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS complaints (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  complaint_type complaint_type NOT NULL,
  filed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  subject_teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  severity complaint_severity NOT NULL DEFAULT 'medium',
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  status complaint_status NOT NULL DEFAULT 'pending',
  resolution_note TEXT,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_complaints_subject_student
    CHECK (
      (complaint_type = 'student' AND subject_student_id IS NOT NULL AND subject_teacher_id IS NULL)
      OR (complaint_type = 'teacher' AND subject_teacher_id IS NOT NULL AND subject_student_id IS NULL)
    ),
  CONSTRAINT chk_complaints_anonymous_teacher_only
    CHECK (is_anonymous = false OR complaint_type = 'teacher')
);

CREATE INDEX IF NOT EXISTS idx_complaints_tenant_status
  ON complaints (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaints_tenant_filed_by
  ON complaints (tenant_id, filed_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaints_tenant_type
  ON complaints (tenant_id, complaint_type);

CREATE TABLE IF NOT EXISTS complaint_status_history (
  id SERIAL PRIMARY KEY,
  complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_status complaint_status,
  new_status complaint_status NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_complaint_status_history_complaint
  ON complaint_status_history (complaint_id, created_at ASC);
