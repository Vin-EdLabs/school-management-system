-- Migration: protect financial records when students are removed or inactivated
-- Payments, receipts, and ledger entries are preserved (student_id set to NULL on hard delete).

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_student_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;

ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_student_id_fkey;
ALTER TABLE receipts ADD CONSTRAINT receipts_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;

ALTER TABLE student_ledger DROP CONSTRAINT IF EXISTS student_ledger_student_id_fkey;
ALTER TABLE student_ledger ADD CONSTRAINT student_ledger_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
