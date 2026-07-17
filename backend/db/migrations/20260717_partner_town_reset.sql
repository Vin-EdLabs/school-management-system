-- Partner town + password reset tokens

ALTER TABLE partners ADD COLUMN IF NOT EXISTS town VARCHAR(100);

CREATE TABLE IF NOT EXISTS partner_password_reset_tokens (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_reset_token_hash ON partner_password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_partner_reset_partner ON partner_password_reset_tokens (partner_id, created_at DESC);
