-- Seed subjects for children and teenagers
-- Idempotent: skips if code already exists

INSERT INTO subjects (code, name, description, created_by) VALUES
  ('MATH-PR', 'Mathematics (Primary)', 'Mathematics curriculum for children (primary)', NULL),
  ('ENG-PR', 'English (Primary)', 'English language for primary learners', NULL),
  ('SCI-PR', 'Science (Primary)', 'General science for primary level', NULL),
  ('SS-PR', 'Social Studies (Primary)', 'Social studies for children', NULL),
  ('ART-PR', 'Art (Primary)', 'Art & craft for primary learners', NULL),
  ('MUS-PR', 'Music (Primary)', 'Music lessons for children', NULL),
  ('PE-PR', 'Physical Education (Primary)', 'Physical activities and sports', NULL),
  ('ICT-PR', 'ICT (Primary)', 'Basic computer skills for children', NULL),
  ('LANG-PR', 'Local Language (Primary)', 'Home/local language studies', NULL)
ON CONFLICT (code) DO NOTHING;

INSERT INTO subjects (code, name, description, created_by) VALUES
  ('MATH-SC', 'Mathematics', 'Mathematics for secondary level', NULL),
  ('ENG-SC', 'English Language', 'English language and literature', NULL),
  ('BIO-SC', 'Biology', 'Biology for secondary students', NULL),
  ('CHE-SC', 'Chemistry', 'Chemistry for secondary students', NULL),
  ('PHY-SC', 'Physics', 'Physics for secondary students', NULL),
  ('HIS-SC', 'History', 'History and civics', NULL),
  ('GEO-SC', 'Geography', 'Geography and environmental studies', NULL),
  ('CS-SC', 'Computer Science', 'Computer Science and programming', NULL),
  ('ECO-SC', 'Economics', 'Economics and commerce', NULL),
  ('BUS-SC', 'Business Studies', 'Business and entrepreneurship', NULL),
  ('ACC-SC', 'Accounting', 'Accounting and bookkeeping', NULL),
  ('CRE-SC', 'Religious Studies', 'Religious and moral education', NULL),
  ('ART-SC', 'Art', 'Fine art and design', NULL),
  ('MUS-SC', 'Music', 'Music and performing arts', NULL)
ON CONFLICT (code) DO NOTHING;

-- End of seed
