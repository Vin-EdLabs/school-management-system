import { query, getClient } from '../db/connection.js';
import { writeAuditLog } from './auditService.js';

export type TeacherStatus = 'active' | 'suspended' | 'deactivated';

export function normalizeTeacherStatus(raw: string | null | undefined): TeacherStatus {
  const s = String(raw || 'active').trim().toLowerCase();
  if (s === 'suspended') return 'suspended';
  if (s === 'deactivated') return 'deactivated';
  return 'active';
}

async function setTeacherLogin(tenantId: number, teacherId: number, active: boolean) {
  await query(
    `UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $2 AND teacher_id::text = $3::text`,
    [active, tenantId, String(teacherId)]
  );
}

async function unassignTeacherFromClasses(client: any, tenantId: number, teacherId: number) {
  await client.query(
    `UPDATE classes SET assigned_teacher_id = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1 AND assigned_teacher_id = $2`,
    [tenantId, teacherId]
  );
  await client.query(
    `DELETE FROM class_teachers WHERE tenant_id = $1 AND teacher_id = $2`,
    [tenantId, teacherId]
  ).catch(() => {});
  await client.query(
    `UPDATE teachers SET class_assigned_id = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1 AND id = $2`,
    [tenantId, teacherId]
  );
}

export async function suspendTeacher(options: {
  tenantId: number;
  teacherId: number;
  userId: number;
  userRole?: string;
  reason: string;
  suspensionStartDate: string;
  suspensionEndDate?: string | null;
  notes?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const before = await client.query(
      `SELECT t.*, c.class_name FROM teachers t
       LEFT JOIN classes c ON c.id = t.class_assigned_id
       WHERE t.id = $1 AND t.tenant_id = $2 FOR UPDATE`,
      [options.teacherId, options.tenantId]
    );
    if (before.rows.length === 0) throw new Error('Teacher not found');
    const row = before.rows[0];
    if (normalizeTeacherStatus(row.status) === 'deactivated') {
      throw new Error('Cannot suspend a deactivated teacher');
    }

    const statusReason = [options.reason, options.notes?.trim()].filter(Boolean).join(' — ');

    const updated = await client.query(
      `UPDATE teachers SET
         status = 'suspended',
         employment_status = 'Suspended',
         status_reason = $1,
         status_changed_at = CURRENT_TIMESTAMP,
         status_changed_by = $2,
         suspension_start_date = $3,
         suspension_end_date = $4,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [
        statusReason,
        options.userId,
        options.suspensionStartDate,
        options.suspensionEndDate || null,
        options.teacherId,
        options.tenantId,
      ]
    );

    await setTeacherLogin(options.tenantId, options.teacherId, false);
    await client.query('COMMIT');

    await writeAuditLog({
      tenantId: options.tenantId,
      userId: options.userId,
      userRole: options.userRole,
      action: 'TEACHER_SUSPENDED',
      entityType: 'TEACHER',
      entityId: options.teacherId,
      module: 'teachers',
      summary: `Suspended ${row.full_name}`,
      details: {
        reason: options.reason,
        suspensionStartDate: options.suspensionStartDate,
        suspensionEndDate: options.suspensionEndDate || null,
        notes: options.notes || null,
      },
      beforeValues: { status: row.status, class_name: row.class_name },
      afterValues: { status: 'suspended' },
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    });

    return updated.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function deactivateTeacher(options: {
  tenantId: number;
  teacherId: number;
  userId: number;
  userRole?: string;
  reason: string;
  effectiveDate: string;
  notes?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const before = await client.query(
      `SELECT t.*, c.class_name FROM teachers t
       LEFT JOIN classes c ON c.id = t.class_assigned_id
       WHERE t.id = $1 AND t.tenant_id = $2 FOR UPDATE`,
      [options.teacherId, options.tenantId]
    );
    if (before.rows.length === 0) throw new Error('Teacher not found');
    const row = before.rows[0];
    const className = row.class_name || null;

    const statusReason = [options.reason, options.notes?.trim()].filter(Boolean).join(' — ');

    await unassignTeacherFromClasses(client, options.tenantId, options.teacherId);

    const updated = await client.query(
      `UPDATE teachers SET
         status = 'deactivated',
         employment_status = 'Deactivated',
         status_reason = $1,
         status_changed_at = CURRENT_TIMESTAMP,
         status_changed_by = $2,
         deactivation_date = $3,
         deactivation_reason = $4,
         suspension_start_date = NULL,
         suspension_end_date = NULL,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [
        statusReason,
        options.userId,
        options.effectiveDate,
        options.reason,
        options.teacherId,
        options.tenantId,
      ]
    );

    await setTeacherLogin(options.tenantId, options.teacherId, false);
    await client.query('COMMIT');

    await writeAuditLog({
      tenantId: options.tenantId,
      userId: options.userId,
      userRole: options.userRole,
      action: 'TEACHER_DEACTIVATED',
      entityType: 'TEACHER',
      entityId: options.teacherId,
      module: 'teachers',
      summary: `Deactivated ${row.full_name}`,
      details: {
        reason: options.reason,
        effectiveDate: options.effectiveDate,
        notes: options.notes || null,
        previousClass: className,
      },
      beforeValues: { status: row.status, class_name: className },
      afterValues: { status: 'deactivated', class_name: null },
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    });

    return { teacher: updated.rows[0], previousClassName: className };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function reactivateTeacher(options: {
  tenantId: number;
  teacherId: number;
  userId: number | null;
  userRole?: string;
  reason: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const before = await client.query(
      `SELECT * FROM teachers WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [options.teacherId, options.tenantId]
    );
    if (before.rows.length === 0) throw new Error('Teacher not found');
    const row = before.rows[0];
    const prevStatus = normalizeTeacherStatus(row.status);
    if (prevStatus === 'active') throw new Error('Teacher is already active');

    const updated = await client.query(
      `UPDATE teachers SET
         status = 'active',
         employment_status = 'Active',
         status_reason = $1,
         status_changed_at = CURRENT_TIMESTAMP,
         status_changed_by = $2,
         suspension_start_date = NULL,
         suspension_end_date = NULL,
         deactivation_date = NULL,
         deactivation_reason = NULL,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [options.reason, options.userId, options.teacherId, options.tenantId]
    );

    await setTeacherLogin(options.tenantId, options.teacherId, true);
    await client.query('COMMIT');

    await writeAuditLog({
      tenantId: options.tenantId,
      userId: options.userId,
      userRole: options.userRole,
      action: 'TEACHER_REACTIVATED',
      entityType: 'TEACHER',
      entityId: options.teacherId,
      module: 'teachers',
      summary: `Reactivated ${row.full_name}`,
      details: { reason: options.reason, previousStatus: prevStatus },
      beforeValues: { status: prevStatus },
      afterValues: { status: 'active' },
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    });

    return updated.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function processExpiredSuspensions(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const due = await query(
    `SELECT id, tenant_id, full_name, suspension_end_date FROM teachers
     WHERE status = 'suspended'
       AND suspension_end_date IS NOT NULL
       AND suspension_end_date <= $1`,
    [today]
  );
  let count = 0;
  for (const row of due.rows) {
    try {
      await reactivateTeacher({
        tenantId: Number(row.tenant_id),
        teacherId: Number(row.id),
        userId: null,
        reason: `Automatic reactivation — suspension ended ${row.suspension_end_date || today}`,
      });
      count++;
    } catch {
      // continue
    }
  }
  return count;
}

export async function getActiveTeachersSalaryTotal(tenantId: number): Promise<number> {
  const res = await query(
    `SELECT COALESCE(SUM(monthly_salary), 0)::numeric AS total
     FROM teachers
     WHERE tenant_id = $1 AND COALESCE(status, 'active') = 'active'`,
    [tenantId]
  );
  return parseFloat(res.rows[0]?.total || '0') || 0;
}
