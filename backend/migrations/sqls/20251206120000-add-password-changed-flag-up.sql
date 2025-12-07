-- Add password_changed column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed BOOLEAN DEFAULT false;
