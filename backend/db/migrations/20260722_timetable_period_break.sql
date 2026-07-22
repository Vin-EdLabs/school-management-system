-- Mark timetable periods as break rows (full-width, no subject slots)

ALTER TABLE periods ADD COLUMN IF NOT EXISTS is_break BOOLEAN NOT NULL DEFAULT false;
