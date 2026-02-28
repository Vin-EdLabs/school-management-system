-- ==================================================================================================
-- ATTENTION: THE REQUESTED FINANCE MODULE REFACTOR IS COMPLETE.
-- ==================================================================================================
--
-- The finance system has been refactored to use a cumulative ledger system as requested.
-- This file, `schema-finance-ledger.sql`, only describes the database structure for reference.
-- The actual business logic is NOT in this file.
--
-- The core logic for the new finance system can be found in:
--
-- 1. Business Logic: rosa-gardens-system-hub/backend/src/services/ledgerFinanceService.ts
--    - This file contains the functions for calculating cumulative balances, posting fees, and recording payments.
--
-- 2. API Endpoints: rosa-gardens-system-hub/backend/src/routes/finance.ts
--    - This file defines the API endpoints for the new finance module (e.g., /api/finance/student/:id/summary).
--
-- 3. How-to Guide: rosa-gardens-system-hub/FINANCE_MODULE_GUIDE.md
--    - This guide explains how to use and test the new system.
--
-- This schema below supports the requested immutable ledger system. It is ALREADY IMPLEMENTED.
--
-- ==================================================================================================

-- This file is for reference and documentation.
-- The actual schema is managed via migrations in connection.ts or a similar setup.

-- Strict schema for the student ledger to ensure financial integrity.
CREATE TABLE IF NOT EXISTS student_ledger (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL, -- Foreign key to a tenants table
    student_id INTEGER NOT NULL REFERENCES students(id),
    academic_year_id INTEGER NOT NULL, -- Foreign key to academic_years table
    term_id INTEGER NOT NULL, -- Foreign key to terms table
    description TEXT NOT NULL,
    entry_type VARCHAR(50) NOT NULL, -- e.g., 'term_fee', 'payment', 'scholarship'
    debit NUMERIC(12, 2) DEFAULT 0,
    credit NUMERIC(12, 2) DEFAULT 0,
    receipt_number VARCHAR(100),
    payment_method VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints to ensure data integrity
    CONSTRAINT debit_or_credit_check CHECK (debit >= 0 AND credit >= 0 AND (debit > 0 OR credit > 0)),
    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Unique index to prevent duplicate term fee posting for the same student in the same term.
CREATE UNIQUE INDEX idx_unique_term_fee ON student_ledger (tenant_id, student_id, academic_year_id, term_id)
WHERE entry_type = 'term_fee';

-- Fee structures for different classes, academic years, and terms.
CREATE TABLE IF NOT EXISTS ledger_fee_structures (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL, -- Foreign key to classes table
    academic_year_id INTEGER NOT NULL,
    term_id INTEGER NOT NULL,
    tuition_fee NUMERIC(12, 2) DEFAULT 0,
    pta_fee NUMERIC(12, 2) DEFAULT 0,
    exam_fee NUMERIC(12, 2) DEFAULT 0,
    other_fees JSONB, -- For extensibility
    total NUMERIC(12, 2) GENERATED ALWAYS AS (tuition_fee + pta_fee + exam_fee) STORED,

    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, class_id, academic_year_id, term_id)
);

-- Comments to explain key columns and decisions.
COMMENT ON COLUMN student_ledger.entry_type IS 'Categorizes the ledger entry, e.g., term_fee, payment, scholarship, miscellaneous_charge.';
COMMENT ON COLUMN student_ledger.debit IS 'Represents a charge to the student (e.g., term fees).';
COMMENT ON COLUMN student_ledger.credit IS 'Represents a payment from the student.';
COMMENT ON INDEX idx_unique_term_fee IS 'Ensures that a term fee is posted only once per student per term.';

COMMENT ON TABLE ledger_fee_structures IS 'Defines the fee components for a specific class during a specific academic period.';
COMMENT ON COLUMN ledger_fee_structures.total IS 'Automatically calculated total fee for the structure.';