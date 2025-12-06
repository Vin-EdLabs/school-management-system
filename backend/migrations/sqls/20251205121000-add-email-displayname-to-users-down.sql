-- Remove email and display_name columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS display_name;
DROP INDEX IF EXISTS idx_users_email;
