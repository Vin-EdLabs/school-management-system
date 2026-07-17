-- Partner email send log (transactional + admin bulk)

CREATE TABLE IF NOT EXISTS partner_emails (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
  template VARCHAR(50) NOT NULL DEFAULT 'custom',
  subject VARCHAR(255) NOT NULL,
  body_preview TEXT,
  batch_id UUID,
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_emails_sent ON partner_emails (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_emails_batch ON partner_emails (batch_id);
