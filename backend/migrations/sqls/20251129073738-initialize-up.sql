/* Replace with your SQL commands */
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blacklisted_tokens (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  teacher_id INTEGER REFERENCES users(id),
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  class_id INTEGER REFERENCES classes(id),
  status TEXT DEFAULT 'active',
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fee_structures (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  items JSONB,
  term_id INTEGER,
  class_id INTEGER REFERENCES classes(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT,
  term_id INTEGER,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_term ON payments(term_id);

CREATE TABLE IF NOT EXISTS income (
  id SERIAL PRIMARY KEY,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  year INTEGER,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  category TEXT,
  year INTEGER,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_year ON expenses(year);
CREATE INDEX IF NOT EXISTS idx_income_year ON income(year);

-- Note: seed operations (e.g. creating admin user) should be performed separately
