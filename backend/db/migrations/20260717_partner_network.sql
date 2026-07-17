-- ScholarNerve Partner Network: partners, leads, commissions, notifications, training videos

CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  whatsapp VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  region VARCHAR(100) NOT NULL,
  occupation VARCHAR(100),
  momo_number VARCHAR(20) NOT NULL,
  momo_network VARCHAR(20) NOT NULL,
  schools_target VARCHAR(20),
  motivation TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_note TEXT,
  partner_id VARCHAR(20) UNIQUE,
  tier VARCHAR(30) DEFAULT 'partner' CHECK (tier IN ('partner', 'senior_partner', 'team_leader', 'regional_director')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_status ON partners (status);
CREATE INDEX IF NOT EXISTS idx_partners_phone ON partners (phone);

CREATE TABLE IF NOT EXISTS partner_school_leads (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER REFERENCES partners(id),
  school_name VARCHAR(255) NOT NULL,
  proprietor_name VARCHAR(255),
  phone VARCHAR(20),
  region VARCHAR(100),
  student_count VARCHAR(50),
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'demo_booked', 'converted', 'dead')),
  converted_school_id INTEGER,
  converted_at TIMESTAMP,
  plan_amount NUMERIC(10,2),
  commission_rate NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_leads_partner ON partner_school_leads (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_leads_status ON partner_school_leads (status);

CREATE TABLE IF NOT EXISTS partner_commissions (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER REFERENCES partners(id),
  school_id INTEGER,
  lead_id INTEGER REFERENCES partner_school_leads(id),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  plan_amount NUMERIC(10,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMP,
  momo_reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (lead_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions (partner_id, year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions (status);

CREATE TABLE IF NOT EXISTS partner_notifications (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER REFERENCES partners(id),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_notifications_partner ON partner_notifications (partner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_training_videos (
  id SERIAL PRIMARY KEY,
  youtube_url VARCHAR(500) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_video_progress (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER REFERENCES partners(id),
  video_id INTEGER REFERENCES partner_training_videos(id) ON DELETE CASCADE,
  watched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(partner_id, video_id)
);
