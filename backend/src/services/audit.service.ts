import { insertActivityAudit } from '../repositories/audit.repository.js';
import { query } from '../config/db.js';

export async function listLoginAudits(filters: { from?: string; to?: string } = {}) {
  // basic filter implementation
  let sql = `
    SELECT 
      a.id, a.action, a.message, a.target_type as module, a.target_id, a.created_at,
      u.display_name as username, u.role
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.action = $1
  `;
  const params: any[] = ['login'];
  if (filters.from) {
    params.push(filters.from);
    sql += ` AND a.created_at >= $${params.length}`;
  }
  if (filters.to) {
    params.push(filters.to);
    sql += ` AND a.created_at <= $${params.length}`;
  }
  sql += ' ORDER BY a.created_at DESC LIMIT 1000';
  const res = await query(sql, params);
  return res.rows;
}

export async function listActivityAudits(filters: { from?: string; to?: string } = {}) {
  let sql = `
    SELECT 
      a.id, a.action, a.message as item_name, a.target_type as module, a.target_id, a.created_at,
      u.display_name as username, u.role
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (filters.from) {
    params.push(filters.from);
    sql += ` AND a.created_at >= $${params.length}`;
  }
  if (filters.to) {
    params.push(filters.to);
    sql += ` AND a.created_at <= $${params.length}`;
  }
  sql += ' ORDER BY a.created_at DESC LIMIT 1000';
  const res = await query(sql, params);
  return res.rows;
}

export async function createActivityAudit(userId: number, payload: any) {
  const action = payload.actionType?.toLowerCase() || 'activity';
  const meta = {
    message: payload.itemName || payload.reason || '',
    target_type: payload.module,
    target_id: payload.itemId
  };
  await insertActivityAudit(userId, action, meta);
  return { success: true };
}

export async function deleteAuditRecord(id: number) {
  const sql = 'DELETE FROM audit_logs WHERE id = $1';
  await query(sql, [id]);
  return { success: true };
}

export async function clearAllAuditRecords() {
  const sql = 'DELETE FROM audit_logs';
  await query(sql, []);
  return { success: true };
}
