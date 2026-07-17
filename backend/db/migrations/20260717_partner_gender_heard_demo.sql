-- Partner gender + referral source; school lead demo booking date
ALTER TABLE partners ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS heard_from VARCHAR(30);

ALTER TABLE partner_school_leads ADD COLUMN IF NOT EXISTS demo_date DATE;
