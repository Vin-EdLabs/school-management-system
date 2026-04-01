import { query } from '../config/db.js';

export async function ensureBalancesTable() {
    await query(`
    CREATE TABLE IF NOT EXISTS student_balances (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      term_id INTEGER REFERENCES academic_terms(id) ON DELETE CASCADE,
      arrears DECIMAL(10, 2) DEFAULT 0,
      credit_balance DECIMAL(10, 2) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, term_id)
    );
  `);
}

export async function updateBalance(studentId: number, termId: number, data: { arrears?: number; credit_balance?: number }) {
    await ensureBalancesTable();
    const res = await query(
        `INSERT INTO student_balances (student_id, term_id, arrears, credit_balance, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (student_id, term_id)
     DO UPDATE SET 
       arrears = COALESCE(EXCLUDED.arrears, student_balances.arrears),
       credit_balance = COALESCE(EXCLUDED.credit_balance, student_balances.credit_balance),
       updated_at = NOW()
     RETURNING *`,
        [studentId, termId, data.arrears ?? 0, data.credit_balance ?? 0]
    );
    return res.rows[0];
}

export async function getBalancesForTerm(termId: number) {
    await ensureBalancesTable();
    const res = await query('SELECT * FROM student_balances WHERE term_id = $1', [termId]);
    return res.rows;
}

export async function getBalanceForStudent(studentId: number, termId: number) {
    await ensureBalancesTable();
    const res = await query('SELECT * FROM student_balances WHERE student_id = $1 AND term_id = $2 LIMIT 1', [studentId, termId]);
    return res.rows[0];
}

export async function listAllBalances() {
    await ensureBalancesTable();
    const res = await query('SELECT * FROM student_balances');
    return res.rows;
}
