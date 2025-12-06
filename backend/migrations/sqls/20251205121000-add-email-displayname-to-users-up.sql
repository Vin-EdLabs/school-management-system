-- Add email and display_name columns to users table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email'
  ) THEN
    ALTER TABLE users ADD COLUMN email TEXT;
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE users ADD COLUMN display_name TEXT;
  END IF;
END
$$;

-- Migrate existing email and displayName from meta JSONB to dedicated columns
UPDATE users 
SET 
  email = COALESCE(email, meta->>'email'),
  display_name = COALESCE(display_name, meta->>'displayName', meta->>'display_name')
WHERE meta IS NOT NULL;
