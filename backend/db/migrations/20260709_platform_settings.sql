-- Platform-wide UI / feature settings (super-admin controlled)
CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO platform_settings (key, value)
VALUES ('ui', '{"zoomNudgeEnabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
