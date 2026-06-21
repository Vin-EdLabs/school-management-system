CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term_id INTEGER REFERENCES terms(id),
  academic_year_id INTEGER REFERENCES academic_years(id),
  invoice_number VARCHAR(100) NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  term_fee NUMERIC(10,2) DEFAULT 0,
  individual_charges NUMERIC(10,2) DEFAULT 0,
  arrears NUMERIC(10,2) DEFAULT 0,
  credit_applied NUMERIC(10,2) DEFAULT 0,
  total_due NUMERIC(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'issued',
  line_items JSONB DEFAULT '[]'::jsonb,
  generated_by_user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_term ON invoices(term_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created ON invoices(tenant_id, created_at DESC);
