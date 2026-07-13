-- Persistent in-app notification history for school staff + chat mute

CREATE TABLE IF NOT EXISTS staff_user_notifications (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  url TEXT,
  reference_key VARCHAR(160),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_user_notifications_user
  ON staff_user_notifications (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_user_notifications_dedupe
  ON staff_user_notifications (user_id, reference_key)
  WHERE reference_key IS NOT NULL;

ALTER TABLE chat_channel_members
  ADD COLUMN IF NOT EXISTS notifications_muted BOOLEAN NOT NULL DEFAULT false;
