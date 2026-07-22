-- Public contact / demo inquiries from scholarnerve.com marketing pages

CREATE TABLE IF NOT EXISTS platform_inquiries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  school_name VARCHAR(200),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  inquiry_type VARCHAR(40) NOT NULL DEFAULT 'contact',
  message TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  internal_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_inquiries_status ON platform_inquiries(status, created_at DESC);
