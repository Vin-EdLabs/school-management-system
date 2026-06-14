import { query } from '../db/connection.js';

export type ErrorSource = 'frontend' | 'backend' | 'service_worker' | 'pwa';
export type ErrorStatus = 'new' | 'resolved' | 'ignored';
export type ErrorSeverity = 'info' | 'warning' | 'critical';

export interface SystemErrorInput {
  message: string;
  stack?: string | null;
  source: ErrorSource;
  tenantId?: number | null;
  userId?: number | null;
  endpoint?: string | null;
  action?: string | null;
  severity?: ErrorSeverity;
  metadata?: Record<string, unknown> | null;
}

export interface SystemErrorRow {
  id: number;
  message: string;
  stack: string | null;
  source: string;
  tenant_id: number | null;
  user_id: number | null;
  endpoint: string | null;
  action: string | null;
  severity: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
  tenant_name?: string | null;
}

function normalizeSeverity(value?: string | null): ErrorSeverity {
  const v = String(value || 'warning').toLowerCase();
  if (v === 'critical' || v === 'info' || v === 'warning') return v;
  return 'warning';
}

function normalizeSource(value?: string | null): ErrorSource {
  const v = String(value || 'backend').toLowerCase();
  if (v === 'frontend' || v === 'backend' || v === 'service_worker' || v === 'pwa') return v;
  return 'backend';
}

export async function captureSystemError(input: SystemErrorInput): Promise<void> {
  try {
    const message = String(input.message || 'Unknown error').slice(0, 4000);
    const stack = input.stack ? String(input.stack).slice(0, 12000) : null;
    const source = normalizeSource(input.source);
    const severity = normalizeSeverity(input.severity);
    const endpoint = input.endpoint ? String(input.endpoint).slice(0, 500) : null;
    const action = input.action ? String(input.action).slice(0, 500) : null;

    await query(
      `INSERT INTO system_errors
        (message, stack, source, tenant_id, user_id, endpoint, action, severity, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new', $9::jsonb)`,
      [
        message,
        stack,
        source,
        input.tenantId ?? null,
        input.userId ?? null,
        endpoint,
        action,
        severity,
        JSON.stringify(input.metadata || {}),
      ]
    );
  } catch (error) {
    console.error('[systemErrorService] Failed to capture error:', error);
  }
}

export interface SystemErrorFilters {
  tenantId?: string;
  source?: string;
  status?: string;
  severity?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

function buildErrorWhere(filters: SystemErrorFilters): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  let sql = ` FROM system_errors se LEFT JOIN tenants t ON t.id = se.tenant_id WHERE 1=1 `;

  if (filters.tenantId) {
    params.push(Number(filters.tenantId));
    sql += ` AND se.tenant_id = $${params.length}`;
  }
  if (filters.source) {
    params.push(filters.source);
    sql += ` AND se.source = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    sql += ` AND se.status = $${params.length}`;
  }
  if (filters.severity) {
    params.push(filters.severity);
    sql += ` AND se.severity = $${params.length}`;
  }
  if (filters.startDate && filters.endDate) {
    params.push(filters.startDate, filters.endDate);
    sql += ` AND se.created_at >= $${params.length - 1}::timestamptz AND se.created_at < ($${params.length}::date + interval '1 day')`;
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    sql += ` AND (se.message ILIKE $${params.length} OR COALESCE(se.endpoint, '') ILIKE $${params.length} OR COALESCE(se.action, '') ILIKE $${params.length})`;
  }

  return { sql, params };
}

export async function listSystemErrors(
  filters: SystemErrorFilters = {}
): Promise<{ items: SystemErrorRow[]; total: number; limit: number; offset: number }> {
  const { sql: whereSql, params } = buildErrorWhere(filters);
  const limit = Math.min(Math.max(filters.limit || 25, 1), 1000);
  const offset = Math.max(filters.offset || 0, 0);

  const countRes = await query(`SELECT COUNT(*)::int AS count ${whereSql}`, params);
  const total = countRes.rows[0]?.count ?? 0;

  const listParams = [...params, limit, offset];
  const listSql = `
    SELECT se.*, t.name AS tenant_name
    ${whereSql}
    ORDER BY se.created_at DESC
    LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
  `;

  const result = await query(listSql, listParams);
  return {
    items: result.rows as SystemErrorRow[],
    total,
    limit,
    offset,
  };
}

export async function updateSystemErrorStatus(
  id: number,
  status: ErrorStatus
): Promise<SystemErrorRow | null> {
  const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
  const result = await query(
    `UPDATE system_errors
     SET status = $1, resolved_at = $2
     WHERE id = $3
     RETURNING *`,
    [status, resolvedAt, id]
  );
  return (result.rows[0] as SystemErrorRow) || null;
}

export async function clearSystemErrors(filters: SystemErrorFilters = {}): Promise<number> {
  const { sql: whereSql, params } = buildErrorWhere(filters);
  const del = await query(
    `DELETE FROM system_errors se
     WHERE se.id IN (SELECT se.id ${whereSql})`,
    params
  );
  return del.rowCount ?? 0;
}

export async function getSystemHealthSummary() {
  const [recent, critical, bySource, dbCheck] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS count
       FROM system_errors
       WHERE created_at >= NOW() - interval '24 hours'
         AND status = 'new'`
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM system_errors
       WHERE created_at >= NOW() - interval '24 hours'
         AND status = 'new'
         AND severity = 'critical'`
    ),
    query(
      `SELECT source, COUNT(*)::int AS count
       FROM system_errors
       WHERE created_at >= NOW() - interval '7 days'
         AND status = 'new'
       GROUP BY source
       ORDER BY count DESC`
    ),
    query('SELECT 1 AS ok'),
  ]);

  const newLast24h = recent.rows[0]?.count ?? 0;
  const criticalLast24h = critical.rows[0]?.count ?? 0;

  let status: 'healthy' | 'minor' | 'critical' = 'healthy';
  if (criticalLast24h > 0) status = 'critical';
  else if (newLast24h > 0) status = 'minor';

  return {
    status,
    database: dbCheck.rows[0]?.ok === 1 ? 'connected' : 'unknown',
    newErrorsLast24h: newLast24h,
    criticalErrorsLast24h: criticalLast24h,
    errorsBySource: bySource.rows,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  };
}
