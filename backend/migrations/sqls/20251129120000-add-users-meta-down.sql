-- Remove meta column from users (rollback)
ALTER TABLE users
  DROP COLUMN IF EXISTS meta;
