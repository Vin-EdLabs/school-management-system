import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { writeAuditLog } from '../services/auditService.js';
import { enrichAuditLogRow, AUDIT_ENTITY_JOINS, AUDIT_ENTITY_LABEL_SQL } from '../utils/auditDisplay.js';
import { getClientIp } from '../utils/clientIp.js';
import { getIO } from '../socket.js';
import type { AuthenticatedSocket } from '../socket.js';

const router = express.Router();

const viewerRoles = ['super-admin', 'administrator', 'finance'] as const;

/** Join actor user + teacher/other_staff so we can show full legal names in audit UI. */
const AUDIT_USER_JOINS = `
  LEFT JOIN users u ON al.user_id = u.id
  LEFT JOIN teachers tch ON TRIM(COALESCE(u.teacher_id::text, '')) <> ''
    AND tch.id::text = TRIM(u.teacher_id::text)
    AND tch.tenant_id = COALESCE(u.tenant_id, al.tenant_id)
  LEFT JOIN other_staff stf ON u.other_staff_id IS NOT NULL
    AND stf.id = u.other_staff_id
    AND stf.tenant_id = COALESCE(u.tenant_id, al.tenant_id)
`;

const AUDIT_USER_FULL_NAME_SQL = `COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(TRIM(tch.full_name), ''), NULLIF(TRIM(stf.full_name), ''), u.username) AS user_full_name`;

const AUDIT_USER_DISPLAY_SEARCH = `COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(TRIM(tch.full_name), ''), NULLIF(TRIM(stf.full_name), ''), '')`;

/** Platform/super-admin data ops must not appear in school tenant audit views. */
const TENANT_HIDDEN_AUDIT_ACTIONS = ['BACKUP_EXPORT', 'FULL_RESET', 'BACKUP_IMPORT', 'BACKUP_VALIDATE'];
const TENANT_HIDDEN_AUDIT_MODULES = ['superadmin', 'platform'];

function tenantAuditExclusionSql(alias = 'al'): string {
  return ` AND ${alias}.action NOT IN ('${TENANT_HIDDEN_AUDIT_ACTIONS.join("','")}')
           AND COALESCE(${alias}.module, '') NOT IN ('${TENANT_HIDDEN_AUDIT_MODULES.join("','")}')`;
}

function tenantAuditJoinExclusionSql(alias = 'al'): string {
  return `${alias}.action NOT IN ('${TENANT_HIDDEN_AUDIT_ACTIONS.join("','")}')
          AND COALESCE(${alias}.module, '') NOT IN ('${TENANT_HIDDEN_AUDIT_MODULES.join("','")}')`;
}

function buildTenantAuditWhere(
  tenantId: number,
  q: express.Request['query'],
  params: any[],
  alias = 'al'
): string {
  let sql = ` WHERE ${alias}.tenant_id = $1`;
  params.push(tenantId);

  const { startDate, endDate, action, entityType, module, status, userId, search } = q;

  if (startDate && endDate) {
    sql += ` AND ${alias}.created_at >= $${params.length + 1}::timestamptz AND ${alias}.created_at < ($${params.length + 2}::date + interval '1 day')`;
    params.push(startDate, endDate);
  }

  if (action && String(action).trim()) {
    sql += ` AND ${alias}.action = $${params.length + 1}`;
    params.push(String(action).trim());
  }
  if (entityType && String(entityType).trim()) {
    sql += ` AND ${alias}.entity_type = $${params.length + 1}`;
    params.push(String(entityType).trim());
  }
  if (module && String(module).trim()) {
    sql += ` AND ${alias}.module = $${params.length + 1}`;
    params.push(String(module).trim());
  }
  if (status && String(status).trim()) {
    sql += ` AND ${alias}.status = $${params.length + 1}`;
    params.push(String(status).trim().toLowerCase());
  }
  if (userId) {
    sql += ` AND ${alias}.user_id = $${params.length + 1}`;
    params.push(parseInt(String(userId), 10));
  }
  if (search && String(search).trim()) {
    const s = `%${String(search).trim()}%`;
    sql += ` AND (
      COALESCE(${alias}.summary, '') ILIKE $${params.length + 1}
      OR COALESCE(u.username, '') ILIKE $${params.length + 1}
      OR (${AUDIT_USER_DISPLAY_SEARCH}) ILIKE $${params.length + 1}
      OR COALESCE(${alias}.details::text, '') ILIKE $${params.length + 1}
    )`;
    params.push(s);
  }

  sql += tenantAuditExclusionSql(alias);

  return sql;
}

// Super-admin: all schools
router.get('/all', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, action, entityType, tenantId: rawTenantId, username, module, status, search, limit = '500', offset = '0' } = req.query;
    const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;
    const parsedTenantId = tenantId != null && String(tenantId).trim() !== '' ? parseInt(String(tenantId), 10) : null;
    if (Array.isArray(rawTenantId) || (rawTenantId != null && parsedTenantId === null)) {
      return res.status(400).json({ error: 'Invalid tenantId parameter' });
    }

    let queryText = `
      SELECT al.*, u.username, ${AUDIT_USER_FULL_NAME_SQL}, ten.name as tenant_name,
             ${AUDIT_ENTITY_LABEL_SQL}
      FROM audit_logs al
      ${AUDIT_USER_JOINS}
      ${AUDIT_ENTITY_JOINS}
      LEFT JOIN tenants ten ON al.tenant_id = ten.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      queryText += ` AND al.created_at::date BETWEEN $${params.length + 1}::date AND $${params.length + 2}::date`;
      params.push(startDate, endDate);
    }
    if (action) {
      queryText += ` AND al.action = $${params.length + 1}`;
      params.push(action);
    }
    if (entityType) {
      queryText += ` AND al.entity_type = $${params.length + 1}`;
      params.push(entityType);
    }
    if (module) {
      queryText += ` AND al.module = $${params.length + 1}`;
      params.push(module);
    }
    if (status) {
      queryText += ` AND al.status = $${params.length + 1}`;
      params.push(String(status).toLowerCase());
    }
    if (parsedTenantId !== null) {
      queryText += ` AND al.tenant_id = $${params.length + 1}`;
      params.push(parsedTenantId);
    }
    if (username) {
      queryText += ` AND u.username ILIKE $${params.length + 1}`;
      params.push(`%${username}%`);
    }
    if (search) {
      const s = `%${String(search).trim()}%`;
      queryText += ` AND (COALESCE(al.summary,'') ILIKE $${params.length + 1} OR COALESCE(al.details::text,'') ILIKE $${params.length + 1})`;
      params.push(s);
    }

    const lim = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 1000);
    const off = Math.max(parseInt(String(offset), 10) || 0, 0);
    queryText += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(lim, off);

    const result = await query(queryText, params);
    res.json((result.rows as Record<string, unknown>[]).map((r) => enrichAuditLogRow(r)));
  } catch (error: any) {
    console.error('Get all audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs', detail: error?.message });
  }
});

router.post('/super-admin/portal-visit', async (req, res) => {
  try {
    const { path, visitorId } = req.body || {};
    await writeAuditLog({
      tenantId: null,
      userId: null,
      userRole: 'anonymous',
      action: 'SUPER_ADMIN_PORTAL_VISIT',
      entityType: 'SUPER_ADMIN_PORTAL',
      module: 'superadmin',
      status: 'success',
      summary: 'Super Admin portal visited',
      details: {
        path: typeof path === 'string' ? path.slice(0, 300) : '/super-admin',
        visitorId: typeof visitorId === 'string' ? visitorId.slice(0, 120) : null,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Super admin visit audit error:', error);
    res.status(500).json({ error: 'Failed to record portal visit' });
  }
});

router.get('/super-admin', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { action, status, search, limit = '500', offset = '0' } = req.query;
    const params: any[] = [];
    let queryText = `
      SELECT al.*, u.username, ${AUDIT_USER_FULL_NAME_SQL}, NULL::text as tenant_name,
             ${AUDIT_ENTITY_LABEL_SQL}
      FROM audit_logs al
      ${AUDIT_USER_JOINS}
      ${AUDIT_ENTITY_JOINS}
      WHERE al.module = 'superadmin'
    `;

    if (action && String(action).trim()) {
      queryText += ` AND al.action = $${params.length + 1}`;
      params.push(String(action).trim());
    }
    if (status && String(status).trim()) {
      queryText += ` AND al.status = $${params.length + 1}`;
      params.push(String(status).trim().toLowerCase());
    }
    if (search && String(search).trim()) {
      const s = `%${String(search).trim()}%`;
      queryText += ` AND (
        COALESCE(al.summary, '') ILIKE $${params.length + 1}
        OR COALESCE(u.username, '') ILIKE $${params.length + 1}
        OR COALESCE(al.details::text, '') ILIKE $${params.length + 1}
        OR COALESCE(al.ip_address, '') ILIKE $${params.length + 1}
      )`;
      params.push(s);
    }

    const lim = Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 1000);
    const off = Math.max(parseInt(String(offset), 10) || 0, 0);
    queryText += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(lim, off);

    const result = await query(queryText, params);
    res.json((result.rows as Record<string, unknown>[]).map((r) => enrichAuditLogRow(r)));
  } catch (error) {
    console.error('Get super admin audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch super admin audit logs' });
  }
});

router.get('/super-admin/tracker/users', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(String(req.query.tenantId || ''), 10);
    if (!Number.isFinite(tenantId)) {
      return res.status(400).json({ error: 'Valid tenantId is required' });
    }

    const result = await query(
      `SELECT
         u.id,
         u.username,
         u.email,
         u.role,
         u.full_name,
         COALESCE(NULLIF(TRIM(tch.full_name), ''), NULLIF(TRIM(stf.full_name), ''), NULLIF(TRIM(u.full_name), ''), u.username) AS display_name,
         COUNT(al.id)::int AS activity_count,
         MAX(al.created_at) AS last_activity_at,
         COUNT(al.id) FILTER (WHERE al.module = 'finance' OR al.entity_type IN ('PAYMENT','EXPENSE','INCOME','SALARY_PAYMENT','PAYROLL','FEE_STRUCTURE'))::int AS finance_activity_count
       FROM users u
       LEFT JOIN teachers tch ON TRIM(COALESCE(u.teacher_id::text, '')) <> ''
         AND tch.id::text = TRIM(u.teacher_id::text)
         AND tch.tenant_id = u.tenant_id
       LEFT JOIN other_staff stf ON u.other_staff_id IS NOT NULL
         AND stf.id = u.other_staff_id
         AND stf.tenant_id = u.tenant_id
       LEFT JOIN audit_logs al ON al.user_id = u.id AND al.tenant_id = u.tenant_id
         AND ${tenantAuditJoinExclusionSql('al')}
       WHERE u.tenant_id = $1
       GROUP BY u.id, tch.full_name, stf.full_name
       ORDER BY last_activity_at DESC NULLS LAST, display_name ASC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get tracker users error:', error);
    res.status(500).json({ error: 'Failed to fetch tracker users' });
  }
});

router.get('/super-admin/tracker/timeline', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(String(req.query.tenantId || ''), 10);
    const userId = parseInt(String(req.query.userId || ''), 10);
    if (!Number.isFinite(tenantId) || !Number.isFinite(userId)) {
      return res.status(400).json({ error: 'Valid tenantId and userId are required' });
    }

    const params: any[] = [tenantId, userId];
    let where = `WHERE al.tenant_id = $1 AND al.user_id = $2${tenantAuditExclusionSql('al')}`;
    const { module, action, startDate, endDate, search, order = 'desc', limit = '300', offset = '0' } = req.query;

    if (module && String(module).trim()) {
      where += ` AND COALESCE(NULLIF(TRIM(al.module), ''), '') = $${params.length + 1}`;
      params.push(String(module).trim());
    }
    if (action && String(action).trim()) {
      where += ` AND al.action = $${params.length + 1}`;
      params.push(String(action).trim());
    }
    if (startDate && endDate) {
      where += ` AND al.created_at >= $${params.length + 1}::date AND al.created_at < ($${params.length + 2}::date + interval '1 day')`;
      params.push(startDate, endDate);
    }
    if (search && String(search).trim()) {
      const s = `%${String(search).trim()}%`;
      where += ` AND (
        COALESCE(al.summary, '') ILIKE $${params.length + 1}
        OR COALESCE(al.details::text, '') ILIKE $${params.length + 1}
        OR COALESCE(al.entity_type, '') ILIKE $${params.length + 1}
        OR COALESCE(al.action, '') ILIKE $${params.length + 1}
      )`;
      params.push(s);
    }

    const lim = Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 1000);
    const off = Math.max(parseInt(String(offset), 10) || 0, 0);
    const sort = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const listParams = [...params, lim, off];

    const result = await query(
      `SELECT al.*, u.username, ${AUDIT_USER_FULL_NAME_SQL}, ten.name AS tenant_name,
              ${AUDIT_ENTITY_LABEL_SQL}
       FROM audit_logs al
       ${AUDIT_USER_JOINS}
       ${AUDIT_ENTITY_JOINS}
       LEFT JOIN tenants ten ON al.tenant_id = ten.id
       ${where}
       ORDER BY al.created_at ${sort}
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    res.json((result.rows as Record<string, unknown>[]).map((r) => enrichAuditLogRow(r)));
  } catch (error) {
    console.error('Get tracker timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch tracker timeline' });
  }
});

router.get('/super-admin/online-sessions', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const sockets = await getIO().fetchSockets() as unknown as Array<AuthenticatedSocket>;
    const sessions = sockets
      .filter((socket) => socket.user && String(socket.user.role || '').toLowerCase().trim() !== 'parent')
      .map((socket) => ({
        socketId: socket.id,
        userId: socket.user!.id,
        tenantId: socket.user!.tenantId,
        username: socket.user!.username,
        fullName: socket.user!.fullName,
        role: socket.user!.role,
        connectedAt: socket.data?.connectedAt ? new Date(socket.data.connectedAt).toISOString() : null,
      }));

    const tenantIds = Array.from(new Set(sessions.filter((s) => typeof s.tenantId === 'number' && !Number.isNaN(s.tenantId)).map((s) => s.tenantId as number)));
    const tenantNames = new Map<number, string>();
    if (tenantIds.length > 0) {
      const tenantRows = await query(`SELECT id, name FROM tenants WHERE id = ANY($1::int[])`, [tenantIds]);
      tenantRows.rows.forEach((row: any) => {
        tenantNames.set(row.id, row.name);
      });
    }

    const payload = sessions.map((session) => ({
      ...session,
      tenantName: session.tenantId ? tenantNames.get(session.tenantId) ?? `School #${session.tenantId}` : 'Platform',
      durationSeconds: session.connectedAt ? Math.max(0, Math.floor((Date.now() - new Date(session.connectedAt).getTime()) / 1000)) : null,
    }));

    res.json(payload);
  } catch (error) {
    console.error('Get online sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch online sessions' });
  }
});

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

/** Dashboard cards */
router.get('/summary', requireRole(...viewerRoles), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE al.created_at >= CURRENT_DATE) AS logs_today,
         COUNT(*) FILTER (WHERE al.created_at >= CURRENT_DATE AND al.action = 'FAILED_LOGIN') AS failed_logins_today,
         COUNT(*) FILTER (WHERE al.created_at >= CURRENT_DATE AND al.status = 'failed') AS failed_actions_today,
         COUNT(*) FILTER (WHERE al.created_at >= CURRENT_DATE AND (
           al.module = 'finance' OR al.entity_type IN ('PAYMENT','EXPENSE','INCOME','SALARY_PAYMENT','PAYROLL','FEE_STRUCTURE')
         )) AS finance_actions_today,
         COUNT(*) FILTER (WHERE al.created_at >= CURRENT_DATE AND (
           al.action ILIKE '%DELETE%' OR (al.entity_type IN ('STUDENT','TEACHER','PAYMENT') AND al.action = 'DELETE')
         )) AS delete_actions_today,
         COUNT(DISTINCT al.user_id) FILTER (WHERE al.created_at >= CURRENT_DATE AND al.user_id IS NOT NULL) AS active_users_today
       FROM audit_logs al
       WHERE al.tenant_id = $1${tenantAuditExclusionSql('al')}`,
      [tenantId]
    );
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Audit summary error:', error);
    res.status(500).json({ error: 'Failed to load audit summary' });
  }
});

/** CSV export (same filters as list) */
router.get('/export', requireRole(...viewerRoles), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const params: any[] = [];
    const where = buildTenantAuditWhere(tenantId, req.query, params, 'al');
    const rows = await query(
      `SELECT al.created_at, al.action, al.status, al.module, al.entity_type, al.entity_id, al.summary,
              al.user_role, u.username, ${AUDIT_USER_FULL_NAME_SQL}, al.ip_address, al.user_agent, al.details,
              al.before_values, al.after_values, ${AUDIT_ENTITY_LABEL_SQL}
       FROM audit_logs al
       ${AUDIT_USER_JOINS}
       ${AUDIT_ENTITY_JOINS}
       ${where}
       ORDER BY al.created_at DESC
       LIMIT 5000`,
      params
    );
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v).replace(/"/g, '""');
      return `"${s}"`;
    };
    const header = [
      'created_at',
      'action',
      'status',
      'module',
      'entity_type',
      'entity_label',
      'summary',
      'user_role',
      'username',
      'user_full_name',
      'ip_address',
      'user_agent',
      'details',
    ];
    const lines = [header.join(',')];
    for (const raw of rows.rows as Record<string, unknown>[]) {
      const r = enrichAuditLogRow(raw);
      lines.push(
        [
          esc(r.created_at),
          esc(r.action),
          esc(r.status),
          esc(r.module),
          esc(r.entity_type),
          esc(r.entity_label),
          esc(r.summary),
          esc(r.user_role),
          esc(r.username),
          esc(r.user_full_name),
          esc(r.ip_address),
          esc(r.user_agent),
          esc(typeof r.details === 'object' ? JSON.stringify(r.details) : r.details),
        ].join(',')
      );
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-export.csv"');
    res.send(lines.join('\n'));
  } catch (error) {
    console.error('Audit export error:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

/** Paginated list */
router.get('/', requireRole(...viewerRoles), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset), 10) || 0, 0);

    const params: any[] = [];
    const where = buildTenantAuditWhere(tenantId, req.query, params, 'al');

    const countRes = await query(
      `SELECT COUNT(*)::int AS c FROM audit_logs al ${AUDIT_USER_JOINS} ${where}`,
      params
    );
    const total = countRes.rows[0]?.c ?? 0;

    const listParams = [...params, limit, offset];
    const result = await query(
      `SELECT al.*, u.username, ${AUDIT_USER_FULL_NAME_SQL}, ${AUDIT_ENTITY_LABEL_SQL}
       FROM audit_logs al
       ${AUDIT_USER_JOINS}
       ${AUDIT_ENTITY_JOINS}
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    const items = (result.rows as Record<string, unknown>[]).map((r) => enrichAuditLogRow(r));
    res.json({ items, total, limit, offset });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * Client-submitted audit (UI actions). Immutable append-only.
 */
router.post('/log', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const user = req.user!;
    const { action, module, entityType, entityId, status, summary, details } = req.body || {};
    if (!action || typeof action !== 'string' || action.length > 120) {
      return res.status(400).json({ error: 'action is required (max 120 chars)' });
    }
    if (module != null && String(module).length > 120) {
      return res.status(400).json({ error: 'module too long' });
    }
    await writeAuditLog({
      tenantId,
      userId: user.id,
      userRole: user.role,
      action: String(action).toUpperCase().slice(0, 100),
      entityType: entityType != null ? String(entityType).slice(0, 100) : 'UI',
      entityId: entityId != null && entityId !== '' ? parseInt(String(entityId), 10) : null,
      module: module != null ? String(module).slice(0, 120) : 'general',
      status: status === 'failed' ? 'failed' : 'success',
      summary: summary != null ? String(summary).slice(0, 2000) : null,
      details: details && typeof details === 'object' ? details : null,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Post audit log error:', error);
    res.status(500).json({ error: 'Failed to record audit log' });
  }
});

router.get('/:id', requireRole(...viewerRoles), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const result = await query(
      `SELECT al.*, u.username, ${AUDIT_USER_FULL_NAME_SQL}
       FROM audit_logs al
       ${AUDIT_USER_JOINS}
       WHERE al.id = $1 AND al.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json(enrichAuditLogRow(result.rows[0] as Record<string, unknown>));
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

export default router;
