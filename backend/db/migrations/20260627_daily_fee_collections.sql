-- Daily fee collections (parallel to term fee system)

ALTER TABLE classes ADD COLUMN IF NOT EXISTS fee_mode VARCHAR(20) DEFAULT 'term';
DO $$ BEGIN
  ALTER TABLE classes ADD CONSTRAINT classes_fee_mode_check CHECK (fee_mode IN ('term', 'daily'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS daily_fee_structures (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id          INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  term_id           INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  academic_year_id  INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  daily_rate        NUMERIC(10,2) NOT NULL DEFAULT 0,
  weekly_rate       NUMERIC(10,2) NOT NULL DEFAULT 0,
  monthly_rate      NUMERIC(10,2) NOT NULL DEFAULT 0,
  termly_rate       NUMERIC(10,2) NOT NULL DEFAULT 0,
  school_days_count INTEGER NOT NULL DEFAULT 0,
  created_by        INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, class_id, term_id)
);

CREATE TABLE IF NOT EXISTS school_closure_days (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  term_id     INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  closure_date DATE NOT NULL,
  reason      VARCHAR(255),
  created_by  INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, term_id, closure_date)
);

CREATE TABLE IF NOT EXISTS daily_fee_payments (
  id                  BIGSERIAL PRIMARY KEY,
  tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id          INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id            INTEGER NOT NULL REFERENCES classes(id),
  term_id             INTEGER NOT NULL REFERENCES terms(id),
  academic_year_id    INTEGER NOT NULL REFERENCES academic_years(id),
  payment_type        VARCHAR(20) NOT NULL CHECK (payment_type IN ('daily', 'weekly', 'monthly', 'termly')),
  amount_paid         NUMERIC(10,2) NOT NULL,
  payment_date        DATE NOT NULL,
  coverage_start_date DATE NOT NULL,
  coverage_end_date   DATE NOT NULL,
  school_days_covered INTEGER NOT NULL,
  next_due_date       DATE,
  payment_method      VARCHAR(100) DEFAULT 'cash',
  payment_account_id  INTEGER,
  receipt_number      VARCHAR(100),
  notes               TEXT,
  recorded_by_user_id INTEGER,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_fee_payments_tenant ON daily_fee_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_fee_payments_student ON daily_fee_payments(student_id, term_id);
CREATE INDEX IF NOT EXISTS idx_daily_fee_payments_date ON daily_fee_payments(tenant_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_daily_fee_payments_coverage ON daily_fee_payments(student_id, coverage_start_date, coverage_end_date);

CREATE TABLE IF NOT EXISTS daily_fee_collection_records (
  id                    BIGSERIAL PRIMARY KEY,
  tenant_id             INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id            INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id              INTEGER NOT NULL REFERENCES classes(id),
  term_id               INTEGER NOT NULL REFERENCES terms(id),
  collection_date       DATE NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('paid', 'school_closed', 'pending')),
  daily_fee_payment_id  INTEGER REFERENCES daily_fee_payments(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, student_id, collection_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_collection_date ON daily_fee_collection_records(tenant_id, collection_date);
CREATE INDEX IF NOT EXISTS idx_daily_collection_student ON daily_fee_collection_records(student_id, term_id);
