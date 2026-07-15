-- School website: leadership/management team, teachers showcase, distinguished alumni profiles

CREATE TABLE IF NOT EXISTS school_website_team_members (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_type TEXT NOT NULL DEFAULT 'leadership'
    CHECK (member_type IN ('leadership', 'teacher')),
  position TEXT NOT NULL DEFAULT 'other',
  full_name TEXT NOT NULL,
  photo_url TEXT,
  bio TEXT,
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_website_team_members_tenant
  ON school_website_team_members (tenant_id, member_type, sort_order ASC, id ASC);

CREATE TABLE IF NOT EXISTS school_website_alumni_profiles (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  graduation_year TEXT,
  photo_url TEXT,
  achievement TEXT,
  testimonial TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_website_alumni_profiles_tenant
  ON school_website_alumni_profiles (tenant_id, sort_order ASC, id ASC);
