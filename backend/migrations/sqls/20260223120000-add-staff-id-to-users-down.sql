BEGIN;

-- Recreate username column and copy values back from staff_id for teacher accounts
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);

UPDATE users SET username = staff_id WHERE role = 'teacher' AND staff_id IS NOT NULL;

-- Remove unique index on staff_id if present
DROP INDEX IF EXISTS users_staff_id_unique;

-- Drop the staff_id column
ALTER TABLE users DROP COLUMN IF EXISTS staff_id;

COMMIT;
