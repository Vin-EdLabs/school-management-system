import { query, getClient } from '../db/connection.js';

export type RemoveStudentResult = {
  studentId: number;
  tenantId: number;
};

/** School admin: soft-remove a student — hidden from every active list, recoverable only by super admin. */
export async function removeStudent(
  tenantId: number,
  studentId: number,
  actorUserId: number,
  reason?: string
): Promise<RemoveStudentResult> {
  const existing = await query(
    `SELECT id, enrollment_status, is_deleted FROM students WHERE id = $1 AND tenant_id = $2`,
    [studentId, tenantId]
  );
  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Student not found'), { status: 404 });
  }
  if (existing.rows[0].is_deleted) {
    throw Object.assign(new Error('Student is already removed'), { status: 400 });
  }

  await query(
    `UPDATE students
     SET is_deleted = true,
         deleted_at = NOW(),
         deleted_by = $3,
         deletion_reason = $4,
         pre_delete_enrollment_status = enrollment_status,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2`,
    [studentId, tenantId, actorUserId, reason?.trim() || null]
  );

  await query(
    `UPDATE parent_portal_accounts SET is_active = false WHERE tenant_id = $1 AND student_id = $2`,
    [tenantId, studentId]
  ).catch(() => undefined);

  return { studentId, tenantId };
}

/** Super admin: permanently delete a soft-removed student. Cascades to payments, receipts, portal account, etc. */
export async function permanentlyRemoveStudent(tenantId: number, studentId: number): Promise<RemoveStudentResult> {
  const existing = await query(
    `SELECT id, is_deleted FROM students WHERE id = $1 AND tenant_id = $2`,
    [studentId, tenantId]
  );
  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Student not found'), { status: 404 });
  }
  if (!existing.rows[0].is_deleted) {
    throw Object.assign(new Error('Student is not in a removed state'), { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    // These two tables can't rely on the FK's cascade/set-null behavior:
    // student_ledger.student_id is NOT NULL but the FK is ON DELETE SET NULL,
    // and student_admission_letters.student_id is ON DELETE NO ACTION (blocks the delete).
    await client.query('DELETE FROM student_ledger WHERE tenant_id = $1 AND student_id = $2', [tenantId, studentId]);
    await client.query('DELETE FROM student_admission_letters WHERE tenant_id = $1 AND student_id = $2', [tenantId, studentId]);
    await client.query('DELETE FROM students WHERE id = $1 AND tenant_id = $2', [studentId, tenantId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return { studentId, tenantId };
}

/** Super admin: return a soft-removed student to the school's active lists. */
export async function restoreStudent(tenantId: number, studentId: number): Promise<RemoveStudentResult> {
  const existing = await query(
    `SELECT id, is_deleted, pre_delete_enrollment_status FROM students WHERE id = $1 AND tenant_id = $2`,
    [studentId, tenantId]
  );
  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Student not found'), { status: 404 });
  }
  if (!existing.rows[0].is_deleted) {
    throw Object.assign(new Error('Student is not in a removed state'), { status: 400 });
  }

  const restoredStatus = String(existing.rows[0].pre_delete_enrollment_status || 'active');

  await query(
    `UPDATE students
     SET is_deleted = false,
         deleted_at = NULL,
         deleted_by = NULL,
         deletion_reason = NULL,
         pre_delete_enrollment_status = NULL,
         enrollment_status = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2`,
    [studentId, tenantId, restoredStatus]
  );

  await query(
    `UPDATE parent_portal_accounts SET is_active = true WHERE tenant_id = $1 AND student_id = $2`,
    [tenantId, studentId]
  ).catch(() => undefined);

  return { studentId, tenantId };
}
