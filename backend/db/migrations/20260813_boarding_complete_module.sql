-- Complete boarding module: bed history, complaints, rollover, gender enforcement, exeat types, gender fees

-- Bed assignment history
CREATE TABLE IF NOT EXISTS boarding_bed_history (
  id SERIAL PRIMARY KEY,
  bed_id INTEGER REFERENCES boarding_beds(id) ON DELETE SET NULL,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  term_id INTEGER REFERENCES terms(id) ON DELETE SET NULL,
  assigned_date DATE,
  vacated_date DATE,
  reason VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boarding_bed_history_student ON boarding_bed_history(student_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_boarding_bed_history_bed ON boarding_bed_history(bed_id);

-- Boarding-specific complaints
CREATE TABLE IF NOT EXISTS boarding_complaints (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  filed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  parent_summary TEXT,
  severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high')) DEFAULT 'low',
  status VARCHAR(20) CHECK (status IN ('open', 'reviewed', 'escalated', 'resolved')) DEFAULT 'open',
  escalated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boarding_complaints_tenant_status ON boarding_complaints(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_boarding_complaints_student ON boarding_complaints(tenant_id, student_id);

-- Term rollover tracking
CREATE TABLE IF NOT EXISTS boarding_term_rollover (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_term_id INTEGER REFERENCES terms(id) ON DELETE SET NULL,
  to_term_id INTEGER REFERENCES terms(id) ON DELETE SET NULL,
  rolled_over_at TIMESTAMP DEFAULT NOW(),
  rolled_over_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  students_carried INTEGER DEFAULT 0
);

-- Exeat extensions: type, guardian phone, overdue status
ALTER TABLE boarding_exeats ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(20);
ALTER TABLE boarding_exeats ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'exeat';
ALTER TABLE boarding_exeats ADD COLUMN IF NOT EXISTS last_overdue_notice_at TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'boarding_exeats_type_check'
  ) THEN
    ALTER TABLE boarding_exeats
      ADD CONSTRAINT boarding_exeats_type_check CHECK (type IN ('exeat', 'weekend'));
  END IF;
END $$;

-- Extend status to include overdue (drop/recreate check if needed)
ALTER TABLE boarding_exeats DROP CONSTRAINT IF EXISTS boarding_exeats_status_check;
ALTER TABLE boarding_exeats
  ADD CONSTRAINT boarding_exeats_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'signed_out', 'returned', 'overdue'));

-- Overdue notification dedup log
CREATE TABLE IF NOT EXISTS boarding_exeat_overdue_notices (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  exeat_id INTEGER NOT NULL REFERENCES boarding_exeats(id) ON DELETE CASCADE,
  notified_at TIMESTAMP DEFAULT NOW(),
  channel VARCHAR(20) DEFAULT 'whatsapp',
  notice_date DATE DEFAULT CURRENT_DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_boarding_exeat_overdue_daily
  ON boarding_exeat_overdue_notices(exeat_id, channel, notice_date);

-- Dorms: gender required for new assignments
UPDATE boarding_dorms SET gender = 'boys' WHERE gender IS NULL AND LOWER(name) LIKE '%boy%';
UPDATE boarding_dorms SET gender = 'girls' WHERE gender IS NULL AND LOWER(name) LIKE '%girl%';

-- Gender-based fee pricing on term fees
ALTER TABLE boarding_term_fees ADD COLUMN IF NOT EXISTS fee_mode VARCHAR(20) DEFAULT 'same';
ALTER TABLE boarding_term_fees ADD COLUMN IF NOT EXISTS boys_lodging_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE boarding_term_fees ADD COLUMN IF NOT EXISTS boys_feeding_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE boarding_term_fees ADD COLUMN IF NOT EXISTS girls_lodging_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE boarding_term_fees ADD COLUMN IF NOT EXISTS girls_feeding_amount NUMERIC(12, 2) DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'boarding_term_fees_fee_mode_check'
  ) THEN
    ALTER TABLE boarding_term_fees
      ADD CONSTRAINT boarding_term_fees_fee_mode_check CHECK (fee_mode IN ('same', 'by_gender'));
  END IF;
END $$;

-- Gender dorm match trigger (PostgreSQL CHECK cannot use subqueries)
CREATE OR REPLACE FUNCTION boarding_enrollment_gender_match()
RETURNS TRIGGER AS $$
DECLARE
  student_gender TEXT;
  dorm_gender TEXT;
BEGIN
  IF NEW.status = 'boarder' AND NEW.dorm_id IS NOT NULL THEN
    SELECT LOWER(TRIM(COALESCE(gender, ''))) INTO student_gender FROM students WHERE id = NEW.student_id;
    SELECT gender INTO dorm_gender FROM boarding_dorms WHERE id = NEW.dorm_id;

    IF student_gender = 'male' AND dorm_gender IS DISTINCT FROM 'boys' THEN
      RAISE EXCEPTION 'Cannot enroll a male student in a girls dormitory';
    ELSIF student_gender = 'female' AND dorm_gender IS DISTINCT FROM 'girls' THEN
      RAISE EXCEPTION 'Cannot enroll a female student in a boys dormitory';
    ELSIF student_gender NOT IN ('male', 'female') THEN
      RAISE EXCEPTION 'Student gender must be set before boarding enrollment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_boarding_enrollment_gender ON boarding_enrollments;
CREATE TRIGGER trg_boarding_enrollment_gender
  BEFORE INSERT OR UPDATE ON boarding_enrollments
  FOR EACH ROW EXECUTE FUNCTION boarding_enrollment_gender_match();
