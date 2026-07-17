-- Partner account suspension

ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_status_check;
ALTER TABLE partners ADD CONSTRAINT partners_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));

ALTER TABLE partners ADD COLUMN IF NOT EXISTS suspension_note TEXT;
