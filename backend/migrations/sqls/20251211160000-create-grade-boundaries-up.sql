-- Create grade_boundaries table
CREATE TABLE IF NOT EXISTS grade_boundaries (
  id SERIAL PRIMARY KEY,
  grade TEXT NOT NULL,
  min INTEGER NOT NULL,
  max INTEGER NOT NULL,
  school_id INTEGER,
  class_id INTEGER,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Optional indexes
CREATE INDEX IF NOT EXISTS idx_grade_boundaries_school_class ON grade_boundaries(school_id, class_id);
