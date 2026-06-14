-- Term budget system: categories, budgets, lines, alerts

CREATE TABLE IF NOT EXISTS budget_categories (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_budget_categories_tenant ON budget_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_tenant_type ON budget_categories(tenant_id, type);

CREATE TABLE IF NOT EXISTS term_budgets (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) NOT NULL,
  term VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, academic_year, term)
);

CREATE INDEX IF NOT EXISTS idx_term_budgets_tenant ON term_budgets(tenant_id);

CREATE TABLE IF NOT EXISTS budget_lines (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER REFERENCES term_budgets(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  category_name VARCHAR(255) NOT NULL,
  category_type VARCHAR(50) NOT NULL,
  budgeted_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  alert_threshold INTEGER DEFAULT 90,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON budget_lines(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_tenant ON budget_lines(tenant_id);

CREATE TABLE IF NOT EXISTS budget_alerts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  budget_id INTEGER REFERENCES term_budgets(id) ON DELETE CASCADE,
  budget_line_id INTEGER REFERENCES budget_lines(id) ON DELETE CASCADE,
  alert_level VARCHAR(50) NOT NULL,
  percentage_used NUMERIC(5,2),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(budget_line_id, alert_level)
);

CREATE INDEX IF NOT EXISTS idx_budget_alerts_tenant ON budget_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_unread ON budget_alerts(tenant_id, is_read);
