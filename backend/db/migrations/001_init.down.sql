-- 001_init.down.sql - revert initial schema (down)
-- Drops tables and indexes created by 001_init.up.sql

DROP INDEX IF EXISTS idx_income_year;
DROP INDEX IF EXISTS idx_expenses_year;
DROP INDEX IF EXISTS idx_payments_term;
DROP INDEX IF EXISTS idx_payments_student;

DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS income;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS fee_structures;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS blacklisted_tokens;
DROP TABLE IF EXISTS users;
