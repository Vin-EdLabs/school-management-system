-- Lightweight platform usage events (piggybacks on audit log writes)
CREATE TABLE IF NOT EXISTS platform_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  user_role VARCHAR(64),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_created_at
  ON platform_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_events_type_created
  ON platform_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_events_tenant_created
  ON platform_events (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;
