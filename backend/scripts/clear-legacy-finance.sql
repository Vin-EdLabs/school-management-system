-- Clear legacy payments and receipts so you can test the new ledger-only finance.
-- BACKUP YOUR DATABASE BEFORE RUNNING.
-- Run as DB superuser or owner, e.g. psql -U postgres -d your_db -f clear-legacy-finance.sql

-- Remove receipt references first (receipts reference payments)
TRUNCATE TABLE receipts CASCADE;

-- Clear all payments (legacy table; new finance uses student_ledger)
TRUNCATE TABLE payments CASCADE;

-- Optional: clear old fee_structures (new system uses ledger_fee_structures)
-- TRUNCATE TABLE fee_structures CASCADE;

-- student_ledger is NOT truncated; it is the new source of truth.
