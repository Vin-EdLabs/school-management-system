import type pg from 'pg';
import { query } from '../db/connection.js';
import type { AuthRequest } from '../middleware/auth.js';

type QueryFn = typeof query;

function runQuery(client: pg.PoolClient | null): QueryFn {
  return client ? client.query.bind(client) : query;
}

/** Full name or username for a user id. */
export async function resolveUserDisplayName(
  userId: number | null | undefined,
  client: pg.PoolClient | null = null
): Promise<string> {
  if (userId == null || Number.isNaN(Number(userId))) return 'Unknown user';
  const run = runQuery(client);
  const res = await run(
    `SELECT COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(TRIM(tch.full_name), ''), NULLIF(TRIM(stf.full_name), ''), u.username) AS display_name
     FROM users u
     LEFT JOIN teachers tch ON TRIM(COALESCE(u.teacher_id::text, '')) <> ''
       AND tch.id::text = TRIM(u.teacher_id::text)
     LEFT JOIN other_staff stf ON u.other_staff_id IS NOT NULL AND stf.id = u.other_staff_id
     WHERE u.id = $1
     LIMIT 1`,
    [userId]
  );
  return res.rows[0]?.display_name ? String(res.rows[0].display_name) : `User ${userId}`;
}

/** Class name for a class id within a tenant. */
export async function resolveClassName(
  tenantId: number,
  classId: number | null | undefined,
  client: pg.PoolClient | null = null
): Promise<string> {
  if (classId == null || Number.isNaN(Number(classId))) return 'Unknown class';
  const run = runQuery(client);
  const res = await run(
    `SELECT COALESCE(NULLIF(TRIM(class_name), ''), NULLIF(TRIM(name), '')) AS class_name
     FROM classes WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [classId, tenantId]
  );
  return res.rows[0]?.class_name ? String(res.rows[0].class_name) : `Class ${classId}`;
}

/** Student full name with optional admission number. */
export async function resolveStudentLabel(
  tenantId: number,
  studentId: number | null | undefined,
  client: pg.PoolClient | null = null
): Promise<string> {
  if (studentId == null || Number.isNaN(Number(studentId))) return 'Unknown student';
  const run = runQuery(client);
  const res = await run(
    `SELECT s.first_name, s.last_name, s.student_id AS school_code, s.admission_number, c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
     WHERE s.id = $1 AND s.tenant_id = $2 LIMIT 1`,
    [studentId, tenantId]
  );
  if (!res.rows.length) return `Student ${studentId}`;
  const row = res.rows[0];
  const name = `${row.first_name || ''} ${row.last_name || ''}`.trim() || `Student ${studentId}`;
  const code = row.school_code || row.admission_number;
  return code ? `${name} (ID: ${code})` : name;
}

/** Teacher full name with optional staff id. */
export async function resolveTeacherLabel(
  tenantId: number,
  teacherId: number | null | undefined,
  client: pg.PoolClient | null = null
): Promise<string> {
  if (teacherId == null || Number.isNaN(Number(teacherId))) return 'Unknown teacher';
  const run = runQuery(client);
  const res = await run(
    `SELECT full_name, staff_id FROM teachers WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [teacherId, tenantId]
  );
  if (!res.rows.length) return `Teacher ${teacherId}`;
  const name = String(res.rows[0].full_name || '').trim() || `Teacher ${teacherId}`;
  const staffId = res.rows[0].staff_id ? String(res.rows[0].staff_id).trim() : '';
  return staffId ? `${name} (${staffId})` : name;
}

/** Tenant / school name. */
export async function resolveTenantName(
  tenantId: number | null | undefined,
  client: pg.PoolClient | null = null
): Promise<string> {
  if (tenantId == null || Number.isNaN(Number(tenantId))) return 'Unknown school';
  const run = runQuery(client);
  const res = await run(`SELECT name FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
  return res.rows[0]?.name ? String(res.rows[0].name) : `School ${tenantId}`;
}

/** Actor display name from an authenticated request (impersonator when viewing as another user). */
export async function resolveActorFromRequest(req: AuthRequest): Promise<string> {
  if (req.impersonator?.id) {
    if (req.impersonator.fullName?.trim()) return req.impersonator.fullName.trim();
    if (req.impersonator.username?.trim()) return req.impersonator.username.trim();
    const name = await resolveUserDisplayName(req.impersonator.id);
    return name || `User #${req.impersonator.id}`;
  }
  if (!req.user?.id) return req.user?.username || 'Unknown user';
  const name = await resolveUserDisplayName(req.user.id);
  return name || req.user.username || 'Unknown user';
}

/** User id to store on audit_logs — always the real admin when impersonating. */
export function resolveAuditUserId(req: AuthRequest): number | null {
  return req.impersonator?.id ?? req.user?.id ?? null;
}

/** Role to store on audit_logs when impersonating. */
export function resolveAuditUserRole(req: AuthRequest): string | null {
  return req.impersonator?.role ?? req.user?.role ?? null;
}

/** Append "by {name}" when summary does not already mention the actor. */
export function withActor(summary: string, actorName: string | null | undefined): string {
  const s = summary.trim();
  const actor = actorName?.trim();
  if (!actor || s.toLowerCase().includes(`by ${actor.toLowerCase()}`)) return s;
  return `${s} — by ${actor}`;
}

export function formatMoneyGhs(amount: number | string | null | undefined): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'GHS 0';
  return `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
