-- Non-teaching staff module: other_staff table, teacher emergency/bank fields

-- Teacher emergency contact + bank details
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(100);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(100);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255);

-- Full other_staff table (replaces payroll_other_staff)
CREATE TABLE IF NOT EXISTS other_staff (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id VARCHAR(100) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  gender VARCHAR(50),
  date_of_birth DATE,
  passport_photo_url TEXT,
  phone_number VARCHAR(100),
  email VARCHAR(255),
  home_address TEXT,
  national_id VARCHAR(100),
  position VARCHAR(255),
  department VARCHAR(255),
  employment_type VARCHAR(50),
  employment_date DATE,
  monthly_salary NUMERIC(10,2) DEFAULT 0,
  ssnit_number VARCHAR(100),
  ssnit_enabled BOOLEAN DEFAULT false,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(100),
  emergency_contact_relationship VARCHAR(100),
  bank_name VARCHAR(255),
  bank_account_number VARCHAR(100),
  bank_branch VARCHAR(255),
  bank_account_name VARCHAR(255),
  employment_status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, staff_id)
);

-- Migrate from legacy payroll_other_staff if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payroll_other_staff'
  ) THEN
    INSERT INTO other_staff (
      id, tenant_id, staff_id, full_name, position, monthly_salary,
      employment_status, notes, ssnit_enabled, created_at, updated_at
    )
    SELECT
      p.id,
      p.tenant_id,
      CASE
        WHEN p.staff_id IS NULL OR TRIM(p.staff_id) = '' THEN 'STF' || LPAD(p.id::text, 3, '0')
        WHEN p.staff_id LIKE 'STAFF%' THEN REPLACE(p.staff_id, 'STAFF', 'STF')
        WHEN p.staff_id LIKE 'OTH%' THEN REPLACE(p.staff_id, 'OTH', 'STF')
        ELSE p.staff_id
      END,
      p.full_name,
      p.role,
      COALESCE(p.monthly_salary, 0),
      COALESCE(NULLIF(LOWER(TRIM(p.employment_status)), ''), 'active'),
      p.notes,
      COALESCE(p.ssnit_enabled, false),
      p.created_at,
      p.updated_at
    FROM payroll_other_staff p
    ON CONFLICT (tenant_id, staff_id) DO NOTHING;

    -- Preserve user links (same numeric ids)
    PERFORM setval(
      pg_get_serial_sequence('other_staff', 'id'),
      GREATEST(COALESCE((SELECT MAX(id) FROM other_staff), 0), 1)
    );
  END IF;
END $$;

-- Ensure users.other_staff_id references other_staff
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'other_staff_id'
  ) THEN
    ALTER TABLE users ADD COLUMN other_staff_id INTEGER;
  END IF;
END $$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_other_staff_id_fkey;
ALTER TABLE users
  ADD CONSTRAINT users_other_staff_id_fkey
  FOREIGN KEY (other_staff_id) REFERENCES other_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_other_staff_tenant ON other_staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_other_staff_status ON other_staff(tenant_id, employment_status);
