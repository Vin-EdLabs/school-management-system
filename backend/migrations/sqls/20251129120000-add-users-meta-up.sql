-- Add meta JSONB column to users to store profile data (e.g., for teachers)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;
