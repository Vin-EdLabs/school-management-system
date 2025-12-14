-- Add updated_at column to grade_boundaries
ALTER TABLE grade_boundaries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Optionally backfill existing rows
UPDATE grade_boundaries SET updated_at = created_at WHERE updated_at IS NULL;
