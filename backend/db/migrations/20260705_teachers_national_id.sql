-- National ID on teachers (parity with other_staff)
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS national_id VARCHAR(100);
