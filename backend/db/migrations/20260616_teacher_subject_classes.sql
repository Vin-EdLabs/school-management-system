-- Teacher subject-class junction: each row links a teacher, subject, and class context
CREATE TABLE IF NOT EXISTS teacher_subject_classes (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, teacher_id, subject_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_subject_classes_teacher
  ON teacher_subject_classes (tenant_id, teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_subject_classes_class
  ON teacher_subject_classes (tenant_id, class_id);

-- Best-effort migration from legacy flat subjects_taught + class assignments
INSERT INTO teacher_subject_classes (tenant_id, teacher_id, subject_id, class_id)
SELECT DISTINCT t.tenant_id, t.id, s.id, cls.class_id
FROM teachers t
CROSS JOIN LATERAL unnest(COALESCE(t.subjects_taught, ARRAY[]::text[])) AS subj(subject_name)
JOIN subjects s
  ON s.tenant_id = t.tenant_id
 AND lower(trim(s.name)) = lower(trim(subj.subject_name))
JOIN (
  SELECT ct.tenant_id, ct.teacher_id, ct.class_id
  FROM class_teachers ct
  UNION
  SELECT t2.tenant_id, t2.id, t2.class_assigned_id
  FROM teachers t2
  WHERE t2.class_assigned_id IS NOT NULL
) cls ON cls.teacher_id = t.id AND cls.tenant_id = t.tenant_id
WHERE trim(subj.subject_name) <> ''
ON CONFLICT (tenant_id, teacher_id, subject_id, class_id) DO NOTHING;
