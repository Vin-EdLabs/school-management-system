import { query } from '../config/db.js';

export async function listLoginAudits(filters: { from?: string; to?: string } = {}) {
  // basic filter implementation
  let sql = 'SELECT * FROM audit_log WHERE action = $1';
  const params: any[] = ['login'];
  if (filters.from) {
    params.push(filters.from);
    sql += ` AND created_at >= $${params.length}`;
  }
  if (filters.to) {
    params.push(filters.to);
    sql += ` AND created_at <= $${params.length}`;
  }
  sql += ' ORDER BY created_at DESC LIMIT 1000';
  const res = await query(sql, params);
  return res.rows;
}

export async function listActivityAudits(filters: { from?: string; to?: string } = {}) {
  let sql = 'SELECT * FROM audit_log WHERE action != $1';
  const params: any[] = ['login'];
  if (filters.from) {
    params.push(filters.from);
    sql += ` AND created_at >= $${params.length}`;
  }
  if (filters.to) {
    params.push(filters.to);
    sql += ` AND created_at <= $${params.length}`;
  }
  sql += ' ORDER BY created_at DESC LIMIT 1000';
  const res = await query(sql, params);
  return res.rows;
}
