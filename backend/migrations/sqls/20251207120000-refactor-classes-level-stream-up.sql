-- Add level and stream columns to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS stream TEXT;

-- Create index on level for faster queries
CREATE INDEX IF NOT EXISTS idx_classes_level ON classes(level);
CREATE INDEX IF NOT EXISTS idx_classes_stream ON classes(stream);
