-- Remove dedicated student columns
ALTER TABLE students
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS previous_school,
  DROP COLUMN IF EXISTS home_address,
  DROP COLUMN IF EXISTS guardian_contact,
  DROP COLUMN IF EXISTS guardian_name,
  DROP COLUMN IF EXISTS nationality,
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS gender,
  DROP COLUMN IF EXISTS admission_no;
