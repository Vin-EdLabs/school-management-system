ALTER TABLE school_payment_settings
  ADD COLUMN IF NOT EXISTS mtn_momo_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS vodafone_cash_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS airteltigo_name VARCHAR(255);
