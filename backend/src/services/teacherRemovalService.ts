import type { PoolClient } from 'pg';
import { query, getClient } from '../db/connection.js';
import {
  clearParentLink,
  detachAllAssistants,
} from './teacherAssistantService.js';

export type TeacherDeletionType = 'soft' | 'hard';

const REMOVED_NAME = '[Removed]';

/** True when any salary/payroll row references this teacher (finance records must be preserved). */
export async function teacherHasPaymentRecords(tenantId: number, teacherId: number): Promise<boolean> {
  const checks = await Promise.all([
    query(
      `SELECT 1 FROM salary_payments
       WHERE tenant_id = $1 AND payee_type = 'teacher' AND payee_id = $2
       LIMIT 1`,
      [tenantId, teacherId]
    ),
    query(
      `SELECT 1 FROM payroll_runs pr
       JOIN payroll_run_lines prl ON prl.payroll_run_id = pr.id
       WHERE pr.tenant_id = $1 AND prl.payee_type = 'teacher' AND prl.payee_id = $2
       LIMIT 1`,
      [tenantId, teacherId]
    ).catch(() => ({ rows: [] })),
  ]);
  return checks.some((r) => r.rows.length > 0);
}

async function clearTeacherAssignments(client: PoolClient, tenantId: number, teacherId: number) {
  await client.query('DELETE FROM class_teachers WHERE teacher_id = $1 AND tenant_id = $2', [teacherId, tenantId]);
  await client.query('DELETE FROM teacher_subject_classes WHERE teacher_id = $1 AND tenant_id = $2', [
    teacherId,
    tenantId,
  ]).catch(() => undefined);
  await client.query('UPDATE classes SET assigned_teacher_id = NULL WHERE assigned_teacher_id = $1 AND tenant_id = $2', [
    teacherId,
    tenantId,
  ]);
  await client.query(
    `UPDATE teachers
     SET class_assigned_id = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2`,
    [teacherId, tenantId]
  );
}

async function disableTeacherLogin(client: PoolClient, tenantId: number, teacherId: number) {
  await client.query(
    `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1 AND teacher_id::text = $2::text`,
    [tenantId, String(teacherId)]
  ).catch(() => undefined);
}

async function scrubTeacherRowSoft(
  client: PoolClient,
  tenantId: number,
  teacherId: number,
  reason: string | undefined,
  originalName: string,
  originalStaffId: string | null
) {
  const preservedName =
    originalName.trim() && originalName.trim() !== REMOVED_NAME ? originalName.trim() : null;
  await client.query(
    `UPDATE teachers
     SET removed_original_name = COALESCE(removed_original_name, $4),
         removed_original_staff_id = COALESCE(removed_original_staff_id, $5),
         email = NULL,
         phone_number = NULL,
         passport_photo_url = NULL,
         address = NULL,
         national_id = NULL,
         employment_type = NULL,
         signature = NULL,
         gender = NULL,
         date_of_birth = NULL,
         subjects_taught = NULL,
         notes = NULL,
         staff_id = '__removed_' || id::text,
         status = 'soft_deleted',
         is_deleted = true,
         deleted_at = COALESCE(deleted_at, NOW()),
         deletion_type = 'soft',
         parent_teacher_id = NULL,
         deactivation_date = COALESCE(deactivation_date, CURRENT_DATE),
         deactivation_reason = COALESCE($3, deactivation_reason, 'Removed'),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2`,
    [teacherId, tenantId, reason?.trim() || null, preservedName, originalStaffId]
  );
}

async function markTeacherHardDeleted(client: PoolClient, tenantId: number, teacherId: number) {
  await client.query(
    `UPDATE teachers
     SET status = 'hard_deleted',
         is_deleted = true,
         deleted_at = COALESCE(deleted_at, NOW()),
         deletion_type = 'hard',
         parent_teacher_id = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2`,
    [teacherId, tenantId]
  );
}

export type RemoveTeacherResult = {
  outcome: 'deleted' | 'scrubbed' | 'marked';
  deletionType: TeacherDeletionType;
  teacherId: number;
  hadPaymentRecords: boolean;
};

/**
 * Soft or hard removal.
 * - Detaches assistants (main) or parent link (assistant) first.
 * - No payments: physical DELETE.
 * - Soft + payments: scrub PII, status soft_deleted.
 * - Hard + payments: keep all fields, status hard_deleted (payment history keeps real name).
 */
export async function removeTeacher(
  tenantId: number,
  teacherId: number,
  deletionType: TeacherDeletionType,
  reason?: string
): Promise<RemoveTeacherResult> {
  const existing = await query(
    `SELECT id, full_name, staff_id, deleted_at, deletion_type, status, parent_teacher_id
     FROM teachers WHERE id = $1 AND tenant_id = $2`,
    [teacherId, tenantId]
  );
  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Teacher not found'), { status: 404 });
  }
  const row = existing.rows[0];
  const st = String(row.status || 'active');
  if (st === 'soft_deleted' || st === 'hard_deleted' || row.deleted_at) {
    throw Object.assign(new Error('Teacher is already removed'), { status: 400 });
  }

  const hadPaymentRecords = await teacherHasPaymentRecords(tenantId, teacherId);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await detachAllAssistants(client, tenantId, teacherId);
    await clearParentLink(client, tenantId, teacherId);
    await clearTeacherAssignments(client, tenantId, teacherId);
    await disableTeacherLogin(client, tenantId, teacherId);

    if (!hadPaymentRecords) {
      await client.query('DELETE FROM teachers WHERE id = $1 AND tenant_id = $2', [teacherId, tenantId]);
      await client.query('COMMIT');
      return { outcome: 'deleted', deletionType, teacherId, hadPaymentRecords: false };
    }

    if (deletionType === 'hard') {
      await markTeacherHardDeleted(client, tenantId, teacherId);
      await client.query('COMMIT');
      return { outcome: 'marked', deletionType: 'hard', teacherId, hadPaymentRecords: true };
    }

    await scrubTeacherRowSoft(
      client,
      tenantId,
      teacherId,
      reason,
      String(row.full_name || ''),
      row.staff_id ? String(row.staff_id) : null
    );
    await client.query('COMMIT');
    return { outcome: 'scrubbed', deletionType: 'soft', teacherId, hadPaymentRecords: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Superadmin: upgrade soft-deleted teacher to hard-deleted (hidden everywhere). */
export async function permanentlyRemoveTeacher(tenantId: number, teacherId: number): Promise<RemoveTeacherResult> {
  const existing = await query(
    `SELECT id, deletion_type, deleted_at, status FROM teachers WHERE id = $1 AND tenant_id = $2`,
    [teacherId, tenantId]
  );
  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Teacher not found'), { status: 404 });
  }
  const row = existing.rows[0];
  const st = String(row.status || '');
  if (st !== 'soft_deleted' && !(row.deleted_at && row.deletion_type === 'soft')) {
    throw Object.assign(new Error('Teacher is not in soft-removed state'), { status: 400 });
  }

  const hadPaymentRecords = await teacherHasPaymentRecords(tenantId, teacherId);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await detachAllAssistants(client, tenantId, teacherId);

    if (!hadPaymentRecords) {
      await client.query('DELETE FROM teachers WHERE id = $1 AND tenant_id = $2', [teacherId, tenantId]);
      await client.query('COMMIT');
      return { outcome: 'deleted', deletionType: 'hard', teacherId, hadPaymentRecords: false };
    }

    await markTeacherHardDeleted(client, tenantId, teacherId);
    await client.query('COMMIT');
    return { outcome: 'marked', deletionType: 'hard', teacherId, hadPaymentRecords: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function nextTeacherStaffId(tenantId: number): Promise<string> {
  const existing = await query(
    `SELECT staff_id FROM teachers WHERE tenant_id = $1 AND staff_id LIKE 'TCH%' ORDER BY staff_id DESC LIMIT 1`,
    [tenantId]
  );
  if (existing.rows.length === 0) return 'TCH001';
  const last = String(existing.rows[0].staff_id || '');
  const num = parseInt(last.replace(/\D/g, ''), 10);
  return `TCH${(Number.isFinite(num) ? num + 1 : 1).toString().padStart(3, '0')}`;
}

/** Superadmin: return soft-removed teacher to the school's active lists. */
export async function restoreTeacher(tenantId: number, teacherId: number) {
  const existing = await query(
    `SELECT id, staff_id, full_name, removed_original_name, removed_original_staff_id,
            deletion_type, deleted_at, status
     FROM teachers WHERE id = $1 AND tenant_id = $2`,
    [teacherId, tenantId]
  );
  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Teacher not found'), { status: 404 });
  }
  const row = existing.rows[0];
  const st = String(row.status || '');
  if (st !== 'soft_deleted' && !(row.deleted_at && row.deletion_type === 'soft')) {
    throw Object.assign(new Error('Teacher is not in soft-removed state'), { status: 400 });
  }

  const restoredName =
    String(row.removed_original_name || '').trim() ||
    (String(row.full_name || '') !== REMOVED_NAME ? String(row.full_name) : 'Restored Teacher');

  let staffId = String(row.removed_original_staff_id || row.staff_id || '').trim();
  if (!staffId || staffId.startsWith('__removed_')) {
    staffId = await nextTeacherStaffId(tenantId);
  } else {
    const clash = await query(
      `SELECT 1 FROM teachers
       WHERE tenant_id = $1 AND LOWER(staff_id) = LOWER($2) AND id <> $3
         AND COALESCE(status, 'active') NOT IN ('soft_deleted', 'hard_deleted')
       LIMIT 1`,
      [tenantId, staffId, teacherId]
    );
    if (clash.rows.length > 0) staffId = await nextTeacherStaffId(tenantId);
  }

  await query(
    `UPDATE teachers
     SET deleted_at = NULL,
         deletion_type = NULL,
         is_deleted = false,
         status = 'active',
         full_name = $3,
         staff_id = $4,
         parent_teacher_id = NULL,
         removed_original_name = NULL,
         removed_original_staff_id = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2`,
    [teacherId, tenantId, restoredName, staffId]
  );

  await query(
    `UPDATE users SET is_active = true, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1 AND teacher_id::text = $2::text`,
    [tenantId, String(teacherId)]
  ).catch(() => undefined);

  return { teacherId, tenantId, staffId };
}
