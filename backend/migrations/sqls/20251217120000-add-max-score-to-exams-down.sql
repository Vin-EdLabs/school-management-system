-- Remove max_score column from exams
ALTER TABLE exams
DROP COLUMN IF EXISTS max_score;
