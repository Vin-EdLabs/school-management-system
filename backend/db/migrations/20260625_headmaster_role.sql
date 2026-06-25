-- Headmaster role + profile fields for report cards
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super-admin', 'administrator', 'finance', 'teacher', 'staff', 'driver', 'headmaster'));

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS headmaster_title VARCHAR(120) DEFAULT 'Headmaster';
