-- School Website Module: public marketing sites per tenant

CREATE TABLE IF NOT EXISTS school_websites (
  tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  accent_color VARCHAR(20) DEFAULT '#2563eb',
  logo_url TEXT,
  banner_image_url TEXT,
  tagline TEXT,
  welcome_text TEXT,
  welcome_image_url TEXT,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  stats JSONB NOT NULL DEFAULT '{"founded_year":null,"student_count":null,"programs_count":null}'::jsonb,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_website_about (
  tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  history TEXT,
  vision TEXT,
  mission TEXT,
  core_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  director_message TEXT,
  director_name TEXT,
  director_title TEXT,
  director_photo_url TEXT,
  institution_overview TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_website_admission_config (
  tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  requirements TEXT,
  programs JSONB NOT NULL DEFAULT '[]'::jsonb,
  applications_open BOOLEAN NOT NULL DEFAULT true,
  open_date DATE,
  close_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_website_applications (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  dob DATE,
  gender TEXT,
  nationality TEXT,
  program_applied TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  relationship TEXT,
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'accepted', 'rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_website_applications_tenant
  ON school_website_applications (tenant_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS school_website_gallery (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT NOT NULL DEFAULT 'facilities',
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_website_gallery_tenant
  ON school_website_gallery (tenant_id, sort_order ASC, id ASC);

CREATE TABLE IF NOT EXISTS school_website_contact (
  tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  primary_phone TEXT,
  secondary_phone TEXT,
  email TEXT,
  address TEXT,
  map_embed_url TEXT,
  working_hours TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_website_contact_messages (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Website Manager role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'super-admin', 'administrator', 'finance', 'teacher', 'staff', 'driver',
    'headmaster', 'website-manager'
  ));
