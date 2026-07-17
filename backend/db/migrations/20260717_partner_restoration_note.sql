-- Store reason when a suspended partner is unsuspended

ALTER TABLE partners ADD COLUMN IF NOT EXISTS restoration_note TEXT;
