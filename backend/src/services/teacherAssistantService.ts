import type { PoolClient } from 'pg';
import { query } from '../db/connection.js';
import { TEACHER_MAIN_ACTIVE_WHERE_BARE } from '../constants/staffQueries.js';

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

/** Detach all assistants from a main teacher (they become standalone main teachers). */
export async function detachAllAssistants(
  client: PoolClient,
  tenantId: number,
  parentTeacherId: number
): Promise<number> {
  const res = await client.query(
    `UPDATE teachers
     SET parent_teacher_id = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1 AND parent_teacher_id = $2
     RETURNING id`,
    [tenantId, parentTeacherId]
  );
  return res.rowCount ?? 0;
}

/** Detach one assistant from their parent (becomes a main teacher). */
export async function detachAssistantFromParent(tenantId: number, teacherId: number) {
  const res = await query(
    `UPDATE teachers
     SET parent_teacher_id = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1 AND id = $2 AND parent_teacher_id IS NOT NULL
     RETURNING *`,
    [tenantId, teacherId]
  );
  if (res.rows.length === 0) {
    throw httpError('Teacher is not an assistant or was not found', 400);
  }
  return res.rows[0];
}

/** Clear parent link before delete flows. */
export async function clearParentLink(client: PoolClient, tenantId: number, teacherId: number) {
  await client.query(
    `UPDATE teachers SET parent_teacher_id = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1 AND id = $2`,
    [tenantId, teacherId]
  );
}

export async function teacherHasAssistants(tenantId: number, teacherId: number): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM teachers WHERE tenant_id = $1 AND parent_teacher_id = $2 LIMIT 1`,
    [tenantId, teacherId]
  );
  return res.rows.length > 0;
}

/** Validate assigning teacherId as assistant under parentTeacherId (null = main teacher). */
export async function validateParentTeacherAssignment(
  tenantId: number,
  teacherId: number,
  parentTeacherId: number | null | undefined
) {
  if (parentTeacherId == null || parentTeacherId === 0) return;

  const pid = Number(parentTeacherId);
  const tid = Number(teacherId);
  if (!Number.isFinite(pid) || pid <= 0) {
    throw httpError('Invalid parent teacher', 400);
  }
  if (pid === tid) {
    throw httpError('A teacher cannot be assigned as their own assistant', 400);
  }

  const parentRes = await query(
    `SELECT id, full_name FROM teachers
     WHERE tenant_id = $1 AND id = $2 AND ${TEACHER_MAIN_ACTIVE_WHERE_BARE}`,
    [tenantId, pid]
  );
  if (parentRes.rows.length === 0) {
    throw httpError('Selected parent must be an active main teacher', 400);
  }

  const teacherRes = await query(
    `SELECT id, status FROM teachers WHERE tenant_id = $1 AND id = $2`,
    [tenantId, tid]
  );
  if (tid > 0) {
    if (teacherRes.rows.length === 0) {
      throw httpError('Teacher not found', 404);
    }
    const st = String(teacherRes.rows[0].status || 'active');
    if (st === 'soft_deleted' || st === 'hard_deleted') {
      throw httpError('Removed teachers cannot be assigned as assistants', 400);
    }
    const hasKids = await teacherHasAssistants(tenantId, tid);
    if (hasKids) {
      throw httpError('Teachers with assistants cannot be assigned under another teacher', 400);
    }
  }
}
