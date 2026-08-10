import pg from 'pg';

const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  user: 'school_app_user',
  password: 'vin-edi',
  database: 'school_db',
});

const studentRes = await pool.query(`
  SELECT s.id, s.first_name, s.last_name, s.student_id, s.tenant_id, t.name AS school,
         t.boarding_enabled, c.class_name
  FROM students s
  JOIN tenants t ON t.id = s.tenant_id
  LEFT JOIN classes c ON c.id = s.class_assigned_id
  WHERE s.student_id = '20260001'
     OR (LOWER(s.first_name) LIKE '%acquah%' AND LOWER(s.last_name) LIKE '%vincent%')
  ORDER BY s.id DESC
  LIMIT 5
`);

console.log('STUDENT:', JSON.stringify(studentRes.rows, null, 2));

if (studentRes.rows.length === 0) {
  await pool.end();
  process.exit(0);
}

const sid = studentRes.rows[0].id;
const tid = studentRes.rows[0].tenant_id;

const [enroll, btf, ledger, terms, activeTerm] = await Promise.all([
  pool.query('SELECT * FROM boarding_enrollments WHERE student_id = $1 AND tenant_id = $2', [sid, tid]),
  pool.query('SELECT * FROM boarding_term_fees WHERE tenant_id = $1', [tid]),
  pool.query(
    `SELECT id, entry_type, debit, credit, term_id, description
     FROM student_ledger
     WHERE student_id = $1 AND tenant_id = $2
       AND entry_type IN ('boarding_fee','boarding_feeding','boarding_fee_void','boarding_feeding_void')
     ORDER BY id`,
    [sid, tid]
  ),
  pool.query(`SELECT id, name, status FROM terms WHERE tenant_id = $1 ORDER BY id DESC LIMIT 5`, [tid]),
  pool.query(
    `SELECT ss.current_term, ss.current_year, t.id AS term_id
     FROM school_settings ss
     LEFT JOIN terms t ON t.tenant_id = ss.tenant_id AND t.name = ss.current_term
     LEFT JOIN academic_years ay ON ay.id = t.academic_year_id AND ay.name = ss.current_year
     WHERE ss.tenant_id = $1`,
    [tid]
  ),
]);

console.log('ENROLLMENTS:', JSON.stringify(enroll.rows, null, 2));
console.log('BOARDING_TERM_FEES:', JSON.stringify(btf.rows, null, 2));
console.log('LEDGER_BOARDING:', JSON.stringify(ledger.rows, null, 2));
console.log('TERMS:', JSON.stringify(terms.rows, null, 2));
console.log('ACTIVE_TERM:', JSON.stringify(activeTerm.rows, null, 2));

await pool.end();
