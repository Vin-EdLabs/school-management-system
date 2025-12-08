-- Add date_of_admission column to students and backfill from meta
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS date_of_admission DATE;

-- Backfill from meta if present
UPDATE students
SET date_of_admission = COALESCE(date_of_admission, (meta->>'date_of_admission')::date)
WHERE meta IS NOT NULL;
