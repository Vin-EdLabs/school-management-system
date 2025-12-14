-- Migration to connect subjects and grade-related columns to users (teachers)

-- Add teacher_id to subjects if missing
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS teacher_id INTEGER;

-- Add foreign key from subjects.teacher_id -> users(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'subjects' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'teacher_id'
  ) THEN
    ALTER TABLE subjects
      ADD CONSTRAINT subjects_teacher_fk FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- Ensure created_by in exam_types, exams, grades reference users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_types' AND column_name='created_by') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'exam_types' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'created_by'
    ) THEN
      ALTER TABLE exam_types ADD CONSTRAINT exam_types_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exams' AND column_name='created_by') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'exams' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'created_by'
    ) THEN
      ALTER TABLE exams ADD CONSTRAINT exams_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grades' AND column_name='created_by') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'grades' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'created_by'
    ) THEN
      ALTER TABLE grades ADD CONSTRAINT grades_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grades' AND column_name='updated_by') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'grades' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'updated_by'
    ) THEN
      ALTER TABLE grades ADD CONSTRAINT grades_updated_by_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grade_audit' AND column_name='changed_by') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'grade_audit' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'changed_by'
    ) THEN
      ALTER TABLE grade_audit ADD CONSTRAINT grade_audit_changed_by_fk FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END
$$;
