-- Optional: Clear legacy fee/payment data before using ledger-only finance.
-- Run only if you want to reset and test the new ledger system.
-- BACKUP YOUR DATABASE BEFORE RUNNING.

-- Uncomment to clear old payments (ledger is separate; this does not touch student_ledger):
-- TRUNCATE TABLE receipts CASCADE;
-- TRUNCATE TABLE payments CASCADE;

-- Uncomment to clear old fee_structures (optional; ledger_fee_structures are separate):
-- TRUNCATE TABLE fee_structures CASCADE;

-- ========== EXAMPLE: Seed data for testing ledger (run after migrations) ==========
-- Replace :tenant_id, :class_id, :academic_year_id, :term_id, :student_id with real IDs from your DB.

-- 1. Ensure academic year and term exist (migration may have created them):
-- SELECT * FROM academic_years WHERE tenant_id = :tenant_id;
-- SELECT * FROM terms WHERE tenant_id = :tenant_id AND academic_year_id = :academic_year_id;

-- 2. Create a ledger fee structure for a class (e.g. JHS1, Term 1, 1000 total):
-- INSERT INTO ledger_fee_structures (tenant_id, class_id, academic_year_id, term_id, tuition_fee, pta_fee, exam_fee, total)
-- VALUES (:tenant_id, :class_id, :academic_year_id, :term_id, 800, 100, 100, 1000)
-- ON CONFLICT (tenant_id, class_id, academic_year_id, term_id) DO UPDATE SET total = 1000, tuition_fee = 800, pta_fee = 100, exam_fee = 100;

-- 3. Post term fee for one student (debit 1000):
-- INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit)
-- VALUES (:tenant_id, :student_id, :academic_year_id, :term_id, 'Term 1 Fee - JHS1', 'term_fee', 1000, 0);

-- 4. Record payment 600 (credit 600):
-- INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit)
-- VALUES (:tenant_id, :student_id, :academic_year_id, :term_id, 'Payment - Cash', 'payment', 0, 600);

-- 5. Verify balance: total_debit 1000, total_credit 600, balance 400, status owing:
-- SELECT COALESCE(SUM(debit),0) AS total_debit, COALESCE(SUM(credit),0) AS total_credit,
--        COALESCE(SUM(debit),0) - COALESCE(SUM(credit),0) AS balance
-- FROM student_ledger WHERE tenant_id = :tenant_id AND student_id = :student_id;
