-- Create core schema for school-management-system
-- 2025-11-30

-- 1) users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  email TEXT,
  display_name TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('admin','superadmin','teacher','financialmanager','staff'))
);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)';
  ELSE
    -- Fall back to indexing the email stored inside users.meta JSONB
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(((meta->>''email'')))';
  END IF;
END
$$;

-- 2) blacklisted_tokens
CREATE TABLE IF NOT EXISTS blacklisted_tokens (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_token ON blacklisted_tokens(token);

-- 3) audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  message TEXT,
  target_type TEXT,
  target_id INTEGER,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);

-- 4) academic_years
CREATE TABLE IF NOT EXISTS academic_years (
  id SERIAL PRIMARY KEY,
  year_label TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,
  meta JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_academic_years_is_active ON academic_years(is_active);

-- 5) academic_terms
CREATE TABLE IF NOT EXISTS academic_terms (
  id SERIAL PRIMARY KEY,
  academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,
  meta JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_academic_terms_year ON academic_terms(academic_year_id);

-- 6) classes
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  capacity INTEGER,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_classes_name ON classes(name);

-- 7) students
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  other_names TEXT,
  admission_number TEXT UNIQUE,
  date_of_birth DATE,
  gender TEXT,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active',
  contact_phone TEXT,
  contact_email TEXT,
  address TEXT,
  photo_url TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

-- 8) guardians
CREATE TABLE IF NOT EXISTS guardians (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT,
  email TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_guardians (
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  guardian_id INTEGER REFERENCES guardians(id) ON DELETE CASCADE,
  primary_contact BOOLEAN DEFAULT false,
  PRIMARY KEY (student_id, guardian_id)
);

-- 9) fee_structures
CREATE TABLE IF NOT EXISTS fee_structures (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  applies_to_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  applies_to_term_id INTEGER REFERENCES academic_terms(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 10) fee_items
CREATE TABLE IF NOT EXISTS fee_items (
  id SERIAL PRIMARY KEY,
  fee_structure_id INTEGER REFERENCES fee_structures(id) ON DELETE CASCADE,
  code TEXT,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  is_optional BOOLEAN DEFAULT false,
  meta JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_fee_items_structure ON fee_items(fee_structure_id);

-- 11) invoices
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  fee_structure_id INTEGER REFERENCES fee_structures(id) ON DELETE SET NULL,
  term_id INTEGER REFERENCES academic_terms(id) ON DELETE RESTRICT,
  due_date DATE,
  status TEXT DEFAULT 'open',
  total_amount NUMERIC(12,2) DEFAULT 0,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 12) invoice_items
CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  fee_item_id INTEGER REFERENCES fee_items(id) ON DELETE SET NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 13) payments
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT,
  reference TEXT,
  received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  term_id INTEGER REFERENCES academic_terms(id) ON DELETE SET NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'invoice_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id)';
  ELSE
    -- invoice_id not present (older schema); noop
    RAISE NOTICE 'Skipping idx_payments_invoice creation because payments.invoice_id is missing';
  END IF;
END
$$;

-- 14) payment_allocations
CREATE TABLE IF NOT EXISTS payment_allocations (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
  invoice_item_id INTEGER REFERENCES invoice_items(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL
);

-- 15) income and expenses
CREATE TABLE IF NOT EXISTS income (
  id SERIAL PRIMARY KEY,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  category TEXT,
  year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id),
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  category TEXT,
  year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id),
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 16) migrations table already exists (db-migrate)

-- 17) settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB
);

-- 18) notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  level TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  class_id INTEGER REFERENCES classes(id),
  teacher_id INTEGER REFERENCES users(id),
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
