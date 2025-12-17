-- Add max_score column to exams; default to 100 for existing rows
ALTER TABLE exams
ADD COLUMN IF NOT EXISTS max_score INTEGER DEFAULT 100;

-- Ensure NOT NULL if desired in future migrations; for now allow NULLs via default
UPDATE exams SET max_score = 100 WHERE max_score IS NULL;
