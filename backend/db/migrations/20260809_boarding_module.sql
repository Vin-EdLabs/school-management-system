-- Boarding module: tenant toggle + operational tables (tenant_id = school)

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS boarding_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS boarding_dorms (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('boys', 'girls')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boarding_dorms_tenant ON boarding_dorms(tenant_id);

CREATE TABLE IF NOT EXISTS boarding_rooms (
  id SERIAL PRIMARY KEY,
  dorm_id INTEGER NOT NULL REFERENCES boarding_dorms(id) ON DELETE CASCADE,
  room_name VARCHAR(50) NOT NULL,
  capacity INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boarding_rooms_dorm ON boarding_rooms(dorm_id);

CREATE TABLE IF NOT EXISTS boarding_beds (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES boarding_rooms(id) ON DELETE CASCADE,
  bed_number VARCHAR(20) NOT NULL,
  is_occupied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, bed_number)
);

CREATE INDEX IF NOT EXISTS idx_boarding_beds_room ON boarding_beds(room_id);

CREATE TABLE IF NOT EXISTS boarding_enrollments (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  status VARCHAR(10) CHECK (status IN ('boarder', 'day')) DEFAULT 'day',
  dorm_id INTEGER REFERENCES boarding_dorms(id) ON DELETE SET NULL,
  room_id INTEGER REFERENCES boarding_rooms(id) ON DELETE SET NULL,
  bed_id INTEGER REFERENCES boarding_beds(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  converted_from VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, student_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_boarding_enrollments_tenant_term ON boarding_enrollments(tenant_id, term_id);

CREATE TABLE IF NOT EXISTS boarding_exeats (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_name VARCHAR(100),
  destination TEXT,
  departure_date DATE,
  return_date DATE,
  actual_return_date DATE,
  status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected', 'signed_out', 'returned')) DEFAULT 'pending',
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boarding_exeats_tenant_status ON boarding_exeats(tenant_id, status);

CREATE TABLE IF NOT EXISTS boarding_roll_calls (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dorm_id INTEGER REFERENCES boarding_dorms(id) ON DELETE SET NULL,
  roll_call_date DATE NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, dorm_id, roll_call_date)
);

CREATE TABLE IF NOT EXISTS boarding_roll_call_entries (
  id SERIAL PRIMARY KEY,
  roll_call_id INTEGER NOT NULL REFERENCES boarding_roll_calls(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status VARCHAR(10) CHECK (status IN ('present', 'absent')) DEFAULT 'present',
  flagged BOOLEAN DEFAULT FALSE,
  note TEXT,
  UNIQUE(roll_call_id, student_id)
);

CREATE TABLE IF NOT EXISTS boarding_meal_attendance (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  meal_date DATE NOT NULL,
  meal_type VARCHAR(10) CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  status VARCHAR(10) CHECK (status IN ('present', 'absent')) DEFAULT 'present',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, student_id, meal_date, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_boarding_meal_tenant_date ON boarding_meal_attendance(tenant_id, meal_date);

CREATE TABLE IF NOT EXISTS boarding_sick_bay (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reported_date DATE NOT NULL,
  symptoms TEXT,
  action_taken TEXT,
  status VARCHAR(20) CHECK (status IN ('resting', 'sent_home', 'recovered')) DEFAULT 'resting',
  resolved_date DATE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boarding_sick_bay_tenant_status ON boarding_sick_bay(tenant_id, status);
