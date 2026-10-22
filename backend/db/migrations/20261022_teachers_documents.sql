-- Legal / official document attachments on teachers (parity with other_staff.documents)
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'::jsonb;
