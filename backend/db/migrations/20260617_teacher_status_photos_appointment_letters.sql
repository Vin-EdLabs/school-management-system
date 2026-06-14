-- Teacher passport photo
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS passport_photo_url TEXT;

-- Three-status employment system
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status_changed_by INTEGER REFERENCES users(id);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS suspension_start_date DATE;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS suspension_end_date DATE;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS deactivation_date DATE;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS deactivation_reason VARCHAR(100);

UPDATE teachers SET status = 'active'
WHERE status IS NULL OR TRIM(status) = '';

UPDATE teachers SET status = 'deactivated'
WHERE LOWER(COALESCE(employment_status, '')) IN ('left', 'deactivated', 'terminated', 'resigned');

UPDATE teachers SET status = 'suspended'
WHERE LOWER(COALESCE(employment_status, '')) = 'suspended';

-- Appointment letter school-wide configuration (JSON)
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS appointment_letter_config JSONB DEFAULT '{}'::jsonb;

-- Stored appointment letter versions per teacher
CREATE TABLE IF NOT EXISTS teacher_appointment_letters (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  reference_number VARCHAR(80),
  position_title VARCHAR(255),
  employment_type VARCHAR(80),
  monthly_salary NUMERIC(12, 2),
  letter_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_data TEXT,
  generated_by INTEGER REFERENCES users(id),
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, teacher_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_teacher_appointment_letters_teacher
  ON teacher_appointment_letters(tenant_id, teacher_id);
