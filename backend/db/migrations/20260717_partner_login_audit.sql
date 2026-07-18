CREATE TABLE IF NOT EXISTS partner_login_events (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('login', 'logout')),
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_login_events_created
  ON partner_login_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_login_events_partner
  ON partner_login_events (partner_id, created_at DESC);
