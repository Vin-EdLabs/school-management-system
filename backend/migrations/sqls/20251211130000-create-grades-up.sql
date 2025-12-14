-- Create exam types, exams, grades, and grade_audit tables
CREATE TABLE IF NOT EXISTS exam_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  weight NUMERIC DEFAULT 0,
  created_by INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  exam_type_id INTEGER REFERENCES exam_types(id) ON DELETE SET NULL,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  term TEXT,
  exam_date TIMESTAMP WITH TIME ZONE,
  is_locked BOOLEAN DEFAULT FALSE,
  created_by INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  score NUMERIC,
  status TEXT DEFAULT 'OK', -- OK, ABS, EXM, MIS
  remarks TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- upsert constraint: one grade per exam+student
CREATE UNIQUE INDEX IF NOT EXISTS grades_exam_student_uq ON grades (exam_id, student_id);

CREATE TABLE IF NOT EXISTS grade_audit (
  id SERIAL PRIMARY KEY,
  grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE,
  changed_by INTEGER,
  old_value JSONB,
  new_value JSONB,
  change_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
