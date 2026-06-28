import { query } from '../db/connection.js';

/** True when teacher is the main (class) teacher for this class. */
export async function isMainClassTeacher(
  tenantId: number,
  classId: number,
  teacherId: number | null | undefined
): Promise<boolean> {
  if (teacherId == null || !Number.isFinite(Number(teacherId))) return false;

  const mainRow = await query(
    `SELECT 1 FROM class_teachers
     WHERE tenant_id = $1 AND class_id = $2 AND teacher_id = $3 AND is_main = true
     LIMIT 1`,
    [tenantId, classId, teacherId]
  );
  if (mainRow.rows.length > 0) return true;

  const assignedRow = await query(
    `SELECT 1 FROM classes c
     WHERE c.id = $1 AND c.tenant_id = $2 AND c.assigned_teacher_id = $3
       AND NOT EXISTS (
         SELECT 1 FROM class_teachers ct
         WHERE ct.class_id = c.id AND ct.tenant_id = c.tenant_id AND ct.is_main = true
       )
     LIMIT 1`,
    [classId, tenantId, teacherId]
  );
  return assignedRow.rows.length > 0;
}

export async function assertMainClassTeacher(
  tenantId: number,
  classId: number,
  teacherId: number | null | undefined
): Promise<void> {
  const ok = await isMainClassTeacher(tenantId, classId, teacherId);
  if (!ok) {
    throw Object.assign(new Error('Only the main class teacher can perform this action'), { status: 403 });
  }
}
