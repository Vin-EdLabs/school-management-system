-- Remove updated_at column from users table
ALTER TABLE users DROP COLUMN IF EXISTS updated_at;
