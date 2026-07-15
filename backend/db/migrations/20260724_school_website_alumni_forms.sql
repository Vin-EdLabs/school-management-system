-- Transcript / BECE result requests and alumni testimonials

CREATE TABLE IF NOT EXISTS school_website_transcript_requests (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  completion_year TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  document_type TEXT NOT NULL DEFAULT 'transcript'
    CHECK (document_type IN ('transcript', 'bece', 'both')),
  notes TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_website_transcript_requests_tenant
  ON school_website_transcript_requests (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS school_website_testimonial_submissions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  completion_year TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_website_testimonial_submissions_tenant
  ON school_website_testimonial_submissions (tenant_id, created_at DESC);
