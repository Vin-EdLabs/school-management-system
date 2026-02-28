BEGIN;

-- Add the staff_id column used for teacher staff identifiers
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id VARCHAR(50);

-- Populate staff_id for existing teacher accounts from username when username is numeric
UPDATE users SET staff_id = username WHERE role = 'teacher' AND username ~ '^\\d+$';

-- For any teacher without a numeric username, populate staff_id with a generated sequence
DO $$
DECLARE
  r RECORD;
  seq INT := 0;
BEGIN
  FOR r IN SELECT id FROM users WHERE role = 'teacher' AND (staff_id IS NULL OR staff_id = '') ORDER BY id LOOP
    seq := seq + 1;
    UPDATE users SET staff_id = LPAD(CAST(seq AS TEXT), 5, '0') WHERE id = r.id;
  END LOOP;
END$$;

-- Ensure staff_id is unique for teacher accounts
CREATE UNIQUE INDEX IF NOT EXISTS users_staff_id_unique ON users (staff_id) WHERE role = 'teacher' AND staff_id IS NOT NULL;

-- Drop username column (migrated to staff_id)
ALTER TABLE users DROP COLUMN IF EXISTS username;

COMMIT;
