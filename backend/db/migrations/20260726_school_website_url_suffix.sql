-- Public website URL suffix per school: {slug}-{suffix}.scholarnerve.com (default suffix: edu)

ALTER TABLE school_websites
  ADD COLUMN IF NOT EXISTS website_url_suffix VARCHAR(20) NOT NULL DEFAULT 'edu';

UPDATE school_websites
SET website_url_suffix = 'edu'
WHERE website_url_suffix IS NULL OR TRIM(website_url_suffix) = '';
