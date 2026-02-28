
import { query } from '../config/db.js';

export async function insertLoginAudit(userId: number, _meta: Record<string, unknown>) {
  // Use message or other columns since meta doesn't exist anymore
  const message = `User logged in`;
  return query('INSERT INTO audit_logs (user_id, action, message) VALUES ($1, $2, $3)', [userId, 'login', message]);
}

export async function insertActivityAudit(userId: number, action: string, meta: Record<string, unknown>) {
  const message = meta.message || `Action: ${action}`;
  return query('INSERT INTO audit_logs (user_id, action, message) VALUES ($1, $2, $3)', [userId, action, String(message)]);
}
