-- Remove date_of_admission column from students
ALTER TABLE students
  DROP COLUMN IF EXISTS date_of_admission;
