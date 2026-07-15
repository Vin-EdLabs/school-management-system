-- Custom public subdomain for school websites ({subdomain}.edu.scholarnerve.com)

ALTER TABLE school_websites
  ADD COLUMN IF NOT EXISTS public_subdomain VARCHAR(63);

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_websites_public_subdomain_lower
  ON school_websites (LOWER(public_subdomain))
  WHERE public_subdomain IS NOT NULL AND TRIM(public_subdomain) <> '';
