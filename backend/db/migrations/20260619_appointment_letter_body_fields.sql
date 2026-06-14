-- Appointment letter body paragraphs in school config (stored in JSON) and per-letter snapshot columns.

ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255);
ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS role VARCHAR(255);
ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS department VARCHAR(255);
ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS probation_period VARCHAR(120);
ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS working_hours VARCHAR(120);
ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS leave_entitlement VARCHAR(120);
ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS notice_period VARCHAR(120);
ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS body_opening TEXT;
ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS body_closing TEXT;
ALTER TABLE teacher_appointment_letters ADD COLUMN IF NOT EXISTS letter_date DATE;
