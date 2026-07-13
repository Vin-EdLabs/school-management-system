-- Staff attendance: geolocation check-in, late reasons, admin override, auto-checkout

CREATE TABLE IF NOT EXISTS school_attendance_settings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  radius_meters INTEGER NOT NULL DEFAULT 100,
  school_start_time TIME NOT NULL DEFAULT '07:30',
  school_end_time TIME NOT NULL DEFAULT '15:30',
  late_threshold_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_school_attendance_settings_tenant UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIMESTAMPTZ NOT NULL,
  check_out_time TIMESTAMPTZ,
  check_in_latitude DECIMAL(10, 8),
  check_in_longitude DECIMAL(11, 8),
  is_late BOOLEAN NOT NULL DEFAULT false,
  late_reason TEXT,
  check_in_method VARCHAR(20) NOT NULL DEFAULT 'self'
    CHECK (check_in_method IN ('self', 'admin_override')),
  admin_override_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  checkout_method VARCHAR(20)
    CHECK (checkout_method IS NULL OR checkout_method IN ('self', 'auto', 'admin_override')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_staff_attendance_tenant_staff_date UNIQUE (tenant_id, staff_id, date)
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_tenant_date
  ON staff_attendance (tenant_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_tenant_staff
  ON staff_attendance (tenant_id, staff_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_open
  ON staff_attendance (tenant_id, date)
  WHERE check_out_time IS NULL;
