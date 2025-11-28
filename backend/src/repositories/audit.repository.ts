import { query } from '../config/db.js';

export async function insertLoginAudit(userId: number, meta: Record<string, unknown>) {
  return query('INSERT INTO audit_log (user_id, action, meta) VALUES ($1, $2, $3)', [userId, 'login', JSON.stringify(meta)]);
}

export async function insertActivityAudit(userId: number, action: string, meta: Record<string, unknown>) {
  return query('INSERT INTO audit_log (user_id, action, meta) VALUES ($1, $2, $3)', [userId, action, JSON.stringify(meta)]);
}
