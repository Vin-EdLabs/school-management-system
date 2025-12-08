-- Create join table for many-to-many teacher <-> classes
CREATE TABLE IF NOT EXISTS teacher_classes (
  teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, class_id)
);

-- Backfill from classes.teacher_id if the column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classes' AND column_name='teacher_id') THEN
    INSERT INTO teacher_classes (teacher_id, class_id)
    SELECT teacher_id, id FROM classes WHERE teacher_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END
$$;

-- Backfill from users.meta.classAssigned where possible (best-effort)
DO $$
DECLARE
  r RECORD;
  cls_id INTEGER;
  assigned TEXT;
BEGIN
  FOR r IN SELECT id, meta FROM users WHERE meta ? 'classAssigned' LOOP
    assigned := (r.meta ->> 'classAssigned');
    IF assigned IS NULL OR assigned = '' THEN
      CONTINUE;
    END IF;

    -- Try matching by classes.name (only if the column exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classes' AND column_name='name') THEN
      SELECT id INTO cls_id FROM classes WHERE name = assigned LIMIT 1;
    END IF;
    IF cls_id IS NULL THEN
      -- try level + ' ' + stream if those columns exist
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classes' AND column_name='level') AND
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classes' AND column_name='stream') THEN
        SELECT id INTO cls_id FROM classes WHERE (level || COALESCE(' ' || stream, '')) = assigned LIMIT 1;
      END IF;
    END IF;

    IF cls_id IS NOT NULL THEN
      INSERT INTO teacher_classes (teacher_id, class_id) VALUES (r.id, cls_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END
$$;

-- Remove legacy teacher_id column from classes if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classes' AND column_name='teacher_id') THEN
    ALTER TABLE classes DROP COLUMN IF EXISTS teacher_id;
  END IF;
END
$$;

-- Remove classAssigned from user meta
UPDATE users SET meta = meta - 'classAssigned' WHERE meta ? 'classAssigned';
