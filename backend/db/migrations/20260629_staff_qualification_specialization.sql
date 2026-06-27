-- Qualification and specialization for teachers and other staff

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS qualification TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS specialization TEXT;
ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS qualification TEXT;
ALTER TABLE other_staff ADD COLUMN IF NOT EXISTS specialization TEXT;
