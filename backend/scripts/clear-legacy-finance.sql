-- Clear ALL finance data for every tenant (fees, payments, accounts, income, expenses, payroll).
-- BACKUP YOUR DATABASE BEFORE RUNNING.
-- Prefer: node scripts/clear-all-finance-data.mjs

BEGIN;

UPDATE payments SET corrects_payment_id = NULL, corrected_by_payment_id = NULL;
UPDATE fund_transfers SET original_transfer_id = NULL;

TRUNCATE TABLE receipt_corrections CASCADE;
TRUNCATE TABLE receipts CASCADE;
TRUNCATE TABLE fund_transfers CASCADE;
TRUNCATE TABLE income CASCADE;
TRUNCATE TABLE salary_payments CASCADE;
TRUNCATE TABLE expenses CASCADE;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE payment_accounts CASCADE;
TRUNCATE TABLE student_ledger CASCADE;
TRUNCATE TABLE ledger_fee_structures CASCADE;
TRUNCATE TABLE fee_structures CASCADE;
TRUNCATE TABLE term_arrears CASCADE;
TRUNCATE TABLE student_arrears CASCADE;
TRUNCATE TABLE student_arrears_balance CASCADE;
TRUNCATE TABLE student_credits CASCADE;
TRUNCATE TABLE term_outstanding_balances CASCADE;

UPDATE receipt_number_seq SET last_number = 0, updated_at = CURRENT_TIMESTAMP;
UPDATE school_settings SET legacy_payment_migration_completed = false;

COMMIT;
