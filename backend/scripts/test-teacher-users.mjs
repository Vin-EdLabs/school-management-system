import { query } from '../dist/db/connection.js';
import { ensureAllTeacherUserAccounts } from '../dist/services/teacherUserService.js';

const tenantId = Number(process.argv[2] || 19);
const inspect = process.argv.includes('--inspect');

if (inspect) {
  const r = await query(
    `SELECT id, tenant_id, username, teacher_id, role FROM users
     WHERE username = 'TCH001' OR username ILIKE '%tch%'
     ORDER BY id`
  );
  console.log(JSON.stringify(r.rows, null, 2));
  process.exit(0);
}

try {
  const n = await ensureAllTeacherUserAccounts(tenantId);
  console.log('created', n);
  const r = await query(
    `SELECT u.id, u.username, u.role, u.teacher_id FROM users u WHERE u.tenant_id = $1`,
    [tenantId]
  );
  console.log('users', r.rows.length, r.rows);
} catch (e) {
  console.error('ERR', e?.message, e?.code, e?.detail);
  process.exit(1);
}
