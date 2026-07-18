CREATE TABLE IF NOT EXISTS partner_support_messages (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('partner', 'super-admin')),
  sender_username VARCHAR(100),
  message TEXT NOT NULL,
  is_from_superadmin BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_support_partner
  ON partner_support_messages (partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_support_unread_admin
  ON partner_support_messages (partner_id, created_at DESC)
  WHERE is_from_superadmin = false AND read_at IS NULL AND is_deleted = false;
