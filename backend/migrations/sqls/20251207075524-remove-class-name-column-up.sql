-- Remove name column from classes table since it's now derived from level + stream
ALTER TABLE classes DROP COLUMN name;