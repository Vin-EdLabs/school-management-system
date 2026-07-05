-- Employment type on teachers (parity with other_staff)
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50);
