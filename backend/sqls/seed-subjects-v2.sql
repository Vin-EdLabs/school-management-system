-- Idempotent seed for subjects (matches current subjects table schema)
-- Inserts subjects only if a row with the same name does not already exist

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Mathematics (Primary)', NULL, jsonb_build_object('description','Mathematics curriculum for children (primary)'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Mathematics (Primary)');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'English (Primary)', NULL, jsonb_build_object('description','English language for primary learners'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'English (Primary)');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Science (Primary)', NULL, jsonb_build_object('description','General science for primary level'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Science (Primary)');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Social Studies (Primary)', NULL, jsonb_build_object('description','Social studies for children'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Social Studies (Primary)');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Art (Primary)', NULL, jsonb_build_object('description','Art & craft for primary learners'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Art (Primary)');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Music (Primary)', NULL, jsonb_build_object('description','Music lessons for children'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Music (Primary)');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Physical Education (Primary)', NULL, jsonb_build_object('description','Physical activities and sports'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Physical Education (Primary)');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'ICT (Primary)', NULL, jsonb_build_object('description','Basic computer skills for children'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'ICT (Primary)');

-- Secondary / teenagers
INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Mathematics', NULL, jsonb_build_object('description','Mathematics for secondary level'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Mathematics');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'English Language', NULL, jsonb_build_object('description','English language and literature'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'English Language');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Biology', NULL, jsonb_build_object('description','Biology for secondary students'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Biology');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Chemistry', NULL, jsonb_build_object('description','Chemistry for secondary students'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Chemistry');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Physics', NULL, jsonb_build_object('description','Physics for secondary students'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Physics');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'History', NULL, jsonb_build_object('description','History and civics'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'History');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Geography', NULL, jsonb_build_object('description','Geography and environmental studies'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Geography');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Computer Science', NULL, jsonb_build_object('description','Computer Science and programming'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Computer Science');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Economics', NULL, jsonb_build_object('description','Economics and commerce'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Economics');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Art', NULL, jsonb_build_object('description','Fine art and design'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Art');

INSERT INTO subjects (name, teacher_id, meta, created_at)
SELECT 'Music', NULL, jsonb_build_object('description','Music and performing arts'), NOW()
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE name = 'Music');

-- End
