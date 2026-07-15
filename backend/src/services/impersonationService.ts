import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db/connection.js';
import { writeAuditLog } from './auditService.js';

const JWT_SECRET = () => process.env.JWT_SECRET || 'secret';
const IMPERSONATION_TTL = '4h';

export type ImpersonatorActor = {
  id: number;
  tenantId: number | null;
  role: string;
  username: string;
  fullName: string | null;
  isPrimaryAdmin?: boolean;
};

export type StaffTarget = {
  id: number;
  tenantId: number | null;
  username: string;
  fullName: string;
  role: string;
  teacherId: string | null;
  otherStaffId: number | null;
  isPrimaryAdmin: boolean;
};

export type ParentTarget = {
  accountId: number;
  studentId: number;
  tenantId: number;
  studentDisplayId: string;
  studentName: string;
  schoolName: string;
};

export type ImpersonationSearchRow = {
  kind: 'staff' | 'parent';
  userId?: number;
  parentAccountId?: number;
  studentId?: number;
  label: string;
  sublabel: string;
  role: string;
};

function normalizeRole(role: string | null | undefined): string {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'superadmin') return 'super-admin';
  if (r === 'admin') return 'administrator';
  return r;
}

export function isSuperAdmin(role: string, tenantId: number | null | undefined) {
  return normalizeRole(role) === 'super-admin' && (tenantId == null || Number.isNaN(Number(tenantId)));
}

/** Super-admin by role only — used for audit routing (DB may still have tenant_id). */
export function isPlatformSuperAdminActor(actor: Pick<ImpersonatorActor, 'role'>): boolean {
  return normalizeRole(actor.role) === 'super-admin';
}

export function canStartImpersonation(actor: ImpersonatorActor): boolean {
  if (isPlatformSuperAdminActor(actor)) return true;
  return normalizeRole(actor.role) === 'administrator' && actor.isPrimaryAdmin === true;
}

export function assertCanImpersonateStaff(actor: ImpersonatorActor, target: StaffTarget) {
  if (actor.id === target.id) {
    throw new Error('You cannot impersonate yourself');
  }
  if (normalizeRole(target.role) === 'super-admin') {
    throw new Error('Cannot impersonate a super admin');
  }
  if (isPlatformSuperAdminActor(actor)) {
    return;
  }
  if (normalizeRole(actor.role) !== 'administrator' || !actor.isPrimaryAdmin) {
    throw new Error('Only primary school admins or super admins can impersonate users');
  }
  if (target.tenantId == null || actor.tenantId == null || target.tenantId !== actor.tenantId) {
    throw new Error('You can only impersonate users in your own school');
  }
}

export function assertCanImpersonateParent(actor: ImpersonatorActor, tenantId: number) {
  if (isPlatformSuperAdminActor(actor)) return;
  if (normalizeRole(actor.role) !== 'administrator' || !actor.isPrimaryAdmin) {
    throw new Error('Only primary school admins or super admins can impersonate users');
  }
  if (actor.tenantId == null || actor.tenantId !== tenantId) {
    throw new Error('You can only impersonate parents in your own school');
  }
}

export async function loadStaffUserById(userId: number): Promise<StaffTarget | null> {
  const res = await query(
    `SELECT u.id, u.tenant_id, u.username, u.role, u.teacher_id, u.other_staff_id, u.is_primary_admin,
            COALESCE(t.full_name, s.full_name, u.full_name, u.username) AS full_name
     FROM users u
     LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
     LEFT JOIN other_staff s ON u.other_staff_id = s.id AND s.tenant_id = u.tenant_id
     WHERE u.id = $1 AND COALESCE(u.is_active, true) = true`,
    [userId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    username: row.username,
    fullName: row.full_name,
    role: normalizeRole(row.role),
    teacherId: row.teacher_id ? String(row.teacher_id) : null,
    otherStaffId: row.other_staff_id ?? null,
    isPrimaryAdmin: row.is_primary_admin === true,
  };
}

export async function resolveStaffTargetByIdentifier(
  tenantId: number,
  identifier: string
): Promise<StaffTarget | null> {
  const id = String(identifier || '').trim();
  if (!id) return null;

  const res = await query(
    `SELECT u.id, u.tenant_id, u.username, u.role, u.teacher_id, u.other_staff_id, u.is_primary_admin,
            COALESCE(t.full_name, s.full_name, u.full_name, u.username) AS full_name
     FROM users u
     LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
     LEFT JOIN other_staff s ON u.other_staff_id = s.id AND s.tenant_id = u.tenant_id
     WHERE u.tenant_id = $1 AND COALESCE(u.is_active, true) = true
       AND (
         LOWER(u.username) = LOWER($2)
         OR LOWER(COALESCE(u.email, '')) = LOWER($2)
         OR LOWER(COALESCE(t.staff_id, '')) = LOWER($2)
         OR LOWER(COALESCE(s.staff_id, '')) = LOWER($2)
       )
     LIMIT 1`,
    [tenantId, id]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    username: row.username,
    fullName: row.full_name,
    role: normalizeRole(row.role),
    teacherId: row.teacher_id ? String(row.teacher_id) : null,
    otherStaffId: row.other_staff_id ?? null,
    isPrimaryAdmin: row.is_primary_admin === true,
  };
}

export async function resolveStudentForParentPortal(
  tenantId: number,
  identifier: string
): Promise<{ studentPk: number; studentDisplayId: string; studentName: string } | null> {
  const id = String(identifier || '').trim();
  if (!id) return null;
  const res = await query(
    `SELECT id, student_id, admission_number, first_name, last_name
     FROM students
     WHERE tenant_id = $1
       AND (
         LOWER(TRIM(student_id)) = LOWER($2)
         OR LOWER(TRIM(COALESCE(admission_number, ''))) = LOWER($2)
         OR TRIM(id::text) = $2
       )
     LIMIT 1`,
    [tenantId, id]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  const displayId =
    String(row.student_id || '').trim() ||
    String(row.admission_number || '').trim() ||
    String(row.id);
  return {
    studentPk: row.id,
    studentDisplayId: displayId,
    studentName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
  };
}

export async function ensureParentAccountForStudent(tenantId: number, studentPk: number) {
  const existing = await query(
    `SELECT id, is_active, password_hash FROM parent_portal_accounts WHERE tenant_id = $1 AND student_id = $2`,
    [tenantId, studentPk]
  );
  if (existing.rows.length > 0) {
    const accountId = Number(existing.rows[0].id);
    await query(
      `UPDATE parent_portal_accounts
       SET is_active = true
       WHERE id = $1 AND tenant_id = $2`,
      [accountId, tenantId]
    );
    if (!existing.rows[0].password_hash) {
      const studentRes = await query(
        'SELECT student_id, admission_number FROM students WHERE id = $1 AND tenant_id = $2',
        [studentPk, tenantId]
      );
      const loginId =
        String(studentRes.rows[0]?.student_id || '').trim() ||
        String(studentRes.rows[0]?.admission_number || '').trim() ||
        `S${studentPk}`;
      const hash = await bcrypt.hash(String(loginId), 10);
      await query(
        `UPDATE parent_portal_accounts SET password_hash = $1 WHERE id = $2 AND tenant_id = $3`,
        [hash, accountId, tenantId]
      );
    }
    return accountId;
  }

  const studentRes = await query(
    'SELECT student_id, admission_number FROM students WHERE id = $1 AND tenant_id = $2',
    [studentPk, tenantId]
  );
  if (studentRes.rows.length === 0) throw new Error('Student not found');
  const loginId =
    String(studentRes.rows[0].student_id || '').trim() ||
    String(studentRes.rows[0].admission_number || '').trim() ||
    `S${studentPk}`;

  const hash = await bcrypt.hash(String(loginId), 10);
  const inserted = await query(
    `INSERT INTO parent_portal_accounts (tenant_id, student_id, password_hash, must_change_password, is_active)
     VALUES ($1, $2, $3, false, true)
     RETURNING id`,
    [tenantId, studentPk, hash]
  );
  return Number(inserted.rows[0].id);
}

export async function searchImpersonationTargets(
  tenantId: number,
  q: string,
  limit = 20
): Promise<ImpersonationSearchRow[]> {
  const term = `%${String(q || '').trim()}%`;
  if (!String(q || '').trim()) return [];

  const [staffRes, studentRes] = await Promise.all([
    query(
      `SELECT u.id, u.username, u.role,
              COALESCE(t.full_name, s.full_name, u.full_name, u.username) AS full_name,
              t.staff_id AS teacher_staff_id,
              s.staff_id AS other_staff_id
       FROM users u
       LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
       LEFT JOIN other_staff s ON u.other_staff_id = s.id AND s.tenant_id = u.tenant_id
       WHERE u.tenant_id = $1 AND COALESCE(u.is_active, true) = true
         AND u.role <> 'super-admin'
         AND (
           u.username ILIKE $2 OR COALESCE(u.full_name, '') ILIKE $2
           OR COALESCE(t.full_name, '') ILIKE $2 OR COALESCE(s.full_name, '') ILIKE $2
           OR COALESCE(t.staff_id, '') ILIKE $2 OR COALESCE(s.staff_id, '') ILIKE $2
         )
       ORDER BY full_name ASC
       LIMIT $3`,
      [tenantId, term, limit]
    ),
    query(
      `SELECT s.id, s.student_id, s.admission_number, s.first_name, s.last_name
       FROM students s
       WHERE s.tenant_id = $1
         AND (
           s.student_id ILIKE $2 OR COALESCE(s.admission_number, '') ILIKE $2
           OR (s.first_name || ' ' || s.last_name) ILIKE $2
         )
       ORDER BY s.first_name, s.last_name
       LIMIT $3`,
      [tenantId, term, limit]
    ),
  ]);

  const rows: ImpersonationSearchRow[] = [];

  for (const row of staffRes.rows) {
    rows.push({
      kind: 'staff',
      userId: row.id,
      label: row.full_name,
      sublabel: row.teacher_staff_id || row.other_staff_id || row.username,
      role: normalizeRole(row.role),
    });
  }

  for (const row of studentRes.rows) {
    rows.push({
      kind: 'parent',
      studentId: row.id,
      label: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      sublabel: row.student_id || row.admission_number || `Student #${row.id}`,
      role: 'parent',
    });
  }

  return rows.slice(0, limit);
}

export function signStaffImpersonationToken(actor: ImpersonatorActor, target: StaffTarget) {
  return jwt.sign(
    {
      userId: target.id,
      tenantId: target.tenantId,
      role: target.role,
      impersonatorId: actor.id,
      impersonatorRole: normalizeRole(actor.role),
    },
    JWT_SECRET(),
    { expiresIn: IMPERSONATION_TTL }
  );
}

export function signParentImpersonationToken(
  actor: ImpersonatorActor,
  parentAccountId: number,
  studentId: number,
  tenantId: number
) {
  return jwt.sign(
    {
      parentAccountId,
      studentId,
      tenantId,
      role: 'parent',
      impersonatorId: actor.id,
      impersonatorRole: normalizeRole(actor.role),
    },
    JWT_SECRET(),
    { expiresIn: IMPERSONATION_TTL }
  );
}

export function signAdminRestoreToken(actor: ImpersonatorActor) {
  return jwt.sign(
    {
      userId: actor.id,
      tenantId: actor.tenantId,
      role: normalizeRole(actor.role),
    },
    JWT_SECRET(),
    { expiresIn: '7d' }
  );
}

export async function logImpersonationStart(
  actor: ImpersonatorActor,
  summary: string,
  details: Record<string, unknown>,
  ipAddress?: string | null,
  userAgent?: string | null
) {
  const platformActor = isPlatformSuperAdminActor(actor);
  const targetTenantId =
    typeof details.targetTenantId === 'number' ? (details.targetTenantId as number) : actor.tenantId;

  await writeAuditLog({
    tenantId: platformActor ? null : targetTenantId,
    userId: actor.id,
    userRole: normalizeRole(actor.role),
    action: 'IMPERSONATION_START',
    entityType: 'USER',
    module: platformActor ? 'superadmin' : 'impersonation',
    status: 'success',
    summary,
    details: {
      ...details,
      targetTenantId,
      impersonatorId: actor.id,
      impersonatorName: actor.fullName || actor.username,
      platformScope: platformActor,
    },
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });
}

export async function logImpersonationEnd(
  actor: ImpersonatorActor,
  summary: string,
  details: Record<string, unknown>,
  ipAddress?: string | null,
  userAgent?: string | null
) {
  const platformActor = isPlatformSuperAdminActor(actor);
  const targetTenantId =
    typeof details.targetTenantId === 'number' ? (details.targetTenantId as number) : actor.tenantId;

  await writeAuditLog({
    tenantId: platformActor ? null : targetTenantId,
    userId: actor.id,
    userRole: normalizeRole(actor.role),
    action: 'IMPERSONATION_END',
    entityType: 'USER',
    module: platformActor ? 'superadmin' : 'impersonation',
    status: 'success',
    summary,
    details: {
      ...details,
      targetTenantId,
      impersonatorId: actor.id,
      impersonatorName: actor.fullName || actor.username,
      platformScope: platformActor,
    },
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });
}

/** Wrap audit details when request is during impersonation */
export function impersonationAuditDetails(
  impersonator: { id: number; fullName?: string | null; username?: string } | null | undefined,
  target: { id: number; fullName?: string | null; username?: string } | null | undefined,
  base: Record<string, unknown> = {}
) {
  if (!impersonator) return base;
  return {
    ...base,
    impersonation: true,
    impersonatorId: impersonator.id,
    impersonatorName: impersonator.fullName || impersonator.username,
    actingAsUserId: target?.id,
    actingAsName: target?.fullName || target?.username,
  };
}
