-- Second guardian fields and pending admission support
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_2_name VARCHAR(255);
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_2_contact VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_2_relationship VARCHAR(100);
