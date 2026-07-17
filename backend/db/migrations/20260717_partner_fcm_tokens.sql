-- Partner FCM tokens for reliable closed-app Android push (same as parent portal)

CREATE TABLE IF NOT EXISTS partner_fcm_tokens (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (partner_id, token)
);

CREATE INDEX IF NOT EXISTS idx_partner_fcm_tokens_partner ON partner_fcm_tokens (partner_id);
