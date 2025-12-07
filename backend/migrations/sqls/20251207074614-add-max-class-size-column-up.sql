-- Add max_class_size column to classes table
ALTER TABLE classes ADD COLUMN max_class_size INTEGER DEFAULT 30 NOT NULL;