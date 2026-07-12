ALTER TABLE students ADD COLUMN IF NOT EXISTS is_checkin_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS student_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  action VARCHAR(10) NOT NULL CHECK (action IN ('check_in', 'check_out')),
  action_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  performed_by_type VARCHAR(10) NOT NULL CHECK (performed_by_type IN ('parent', 'staff')),
  performed_by_id INT NOT NULL,
  method VARCHAR(10) NOT NULL CHECK (method IN ('qr_scan', 'manual')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sci_tenant ON student_check_ins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sci_student_time ON student_check_ins(student_id, action_time DESC);
CREATE INDEX IF NOT EXISTS idx_sci_date ON student_check_ins(tenant_id, action_time);
