CREATE TABLE IF NOT EXISTS payroll_runs (
  id SERIAL PRIMARY KEY,
  month_year VARCHAR(10) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  total_amount DECIMAL(12, 2) DEFAULT 0,
  processed_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(month_year)
);

CREATE TABLE IF NOT EXISTS payroll_items (
  id SERIAL PRIMARY KEY,
  payroll_run_id INTEGER REFERENCES payroll_runs(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  base_salary DECIMAL(12, 2) NOT NULL,
  deductions DECIMAL(12, 2) DEFAULT 0,
  bonuses DECIMAL(12, 2) DEFAULT 0,
  net_amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_payments (
  id SERIAL PRIMARY KEY,
  payroll_item_id INTEGER REFERENCES payroll_items(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'bank_transfer',
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  reference_number VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_deductions (
  id SERIAL PRIMARY KEY,
  payroll_item_id INTEGER REFERENCES payroll_items(id) ON DELETE CASCADE,
  deduction_type VARCHAR(100) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_reports (
  id SERIAL PRIMARY KEY,
  payroll_run_id INTEGER REFERENCES payroll_runs(id) ON DELETE CASCADE,
  report_type VARCHAR(50),
  total_staff INTEGER,
  total_paid DECIMAL(12, 2),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_month_year ON payroll_runs(month_year);
CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_staff ON payroll_items(staff_id);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_item ON payroll_payments(payroll_item_id);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_date ON payroll_payments(payment_date);
