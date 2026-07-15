-- Contact form submissions: require phone; email becomes optional
ALTER TABLE school_website_contact_messages
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE school_website_contact_messages
  ALTER COLUMN email DROP NOT NULL;

UPDATE school_website_contact_messages
SET phone = COALESCE(NULLIF(TRIM(phone), ''), '—')
WHERE phone IS NULL OR TRIM(phone) = '';

ALTER TABLE school_website_contact_messages
  ALTER COLUMN phone SET NOT NULL;
