ALTER TABLE parent_messages ADD COLUMN IF NOT EXISTS is_initial_deleted BOOLEAN NOT NULL DEFAULT false;
