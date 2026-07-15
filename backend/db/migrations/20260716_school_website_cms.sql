-- Extended CMS fields for public school websites

ALTER TABLE school_websites
  ADD COLUMN IF NOT EXISTS welcome_image_secondary_url TEXT,
  ADD COLUMN IF NOT EXISTS home_content JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE school_website_about
  ADD COLUMN IF NOT EXISTS history_image_url TEXT,
  ADD COLUMN IF NOT EXISTS overview_image_url TEXT;
