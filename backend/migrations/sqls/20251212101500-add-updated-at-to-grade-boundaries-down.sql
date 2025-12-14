-- Remove updated_at column from grade_boundaries
ALTER TABLE grade_boundaries
  DROP COLUMN IF EXISTS updated_at;
