-- Add dedicated columns for common student attributes
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS admission_no TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS guardian_name TEXT,
  ADD COLUMN IF NOT EXISTS guardian_contact TEXT,
  ADD COLUMN IF NOT EXISTS home_address TEXT,
  ADD COLUMN IF NOT EXISTS previous_school TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill from existing meta if present (best-effort, won't fail if keys missing)
UPDATE students
SET
  admission_no = COALESCE(admission_no, (meta->>'admission_no')),
  gender = COALESCE(gender, (meta->>'gender')),
  date_of_birth = COALESCE(date_of_birth, (meta->>'date_of_birth')::date),
  nationality = COALESCE(nationality, (meta->>'nationality')),
  guardian_name = COALESCE(guardian_name, (meta->>'guardian_name')),
  guardian_contact = COALESCE(guardian_contact, (meta->>'guardian_contact')),
  home_address = COALESCE(home_address, (meta->>'home_address')),
  previous_school = COALESCE(previous_school, (meta->>'previous_school')),
  notes = COALESCE(notes, (meta->>'notes'))
WHERE meta IS NOT NULL;
