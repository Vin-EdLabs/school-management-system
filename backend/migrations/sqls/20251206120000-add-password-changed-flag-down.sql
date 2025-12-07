-- Remove password_changed column from users table
ALTER TABLE users DROP COLUMN IF EXISTS password_changed;
