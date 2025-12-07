-- Drop level and stream columns from classes table
ALTER TABLE classes DROP COLUMN IF EXISTS stream;
ALTER TABLE classes DROP COLUMN IF EXISTS level;

-- Drop indexes (cascade)
DROP INDEX IF EXISTS idx_classes_stream;
DROP INDEX IF EXISTS idx_classes_level;
