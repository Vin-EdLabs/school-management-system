-- Platform billing: ScholarNerve → school subscription invoices.
CREATE TABLE IF NOT EXISTS platform_billing_config (
  id                      SERIAL PRIMARY KEY,
  tenant_id               INTEGER NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  billing_frequency       VARCHAR(20) NOT NULL DEFAULT 'termly'
                            CHECK (billing_frequency IN ('termly', 'yearly', 'monthly')),
  price_per_student_termly  NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_student_yearly  NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_student_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by              INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS platform_invoices (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number      VARCHAR(40) UNIQUE,
  billing_frequency   VARCHAR(20) NOT NULL,
  student_count       INTEGER NOT NULL,
  price_per_student   NUMERIC(10,2) NOT NULL,
  computed_amount     NUMERIC(12,2) NOT NULL,
  final_amount        NUMERIC(12,2) NOT NULL,
  note                TEXT,
  period_label        VARCHAR(120),
  period_start        DATE,
  period_end          DATE,
  due_date            DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'paid', 'waived', 'cancelled')),
  paystack_reference  VARCHAR(100),
  paid_at             TIMESTAMPTZ,
  paid_amount         NUMERIC(12,2),
  posted_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_invoices_tenant ON platform_invoices(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_tenant_status ON platform_invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_platform_invoices_reference ON platform_invoices(paystack_reference);
