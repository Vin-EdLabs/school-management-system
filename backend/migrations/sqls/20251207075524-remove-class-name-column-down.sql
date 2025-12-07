-- Restore name column to classes table
ALTER TABLE classes ADD COLUMN name VARCHAR(100);

-- Backfill name from level + stream
UPDATE classes
SET name = CASE
  WHEN stream IS NOT NULL AND stream != '' THEN level || ' ' || stream
  ELSE level
END
WHERE name IS NULL;