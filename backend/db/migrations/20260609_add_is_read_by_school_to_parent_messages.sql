-- Migration: add a school-side read marker for parent desk messages
-- This column is used by admin-side parent desk unread-count and read acknowledgements.
ALTER TABLE parent_messages
ADD COLUMN IF NOT EXISTS is_read_by_school BOOLEAN NOT NULL DEFAULT false;
