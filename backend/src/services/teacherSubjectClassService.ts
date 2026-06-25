import { query } from '../db/connection.js';

export type SubjectClassPair = { subject_id: number; class_id: number };

export type SubjectClassRow = {
  subject_id: number;
  subject_name: string;
  class_id: number;
  class_name: string;
};

export type GroupedBySubject = {
  subject_id: number;
  subject_name: string;
  classes: Array<{ class_id: number; class_name: string }>;
};

export type GroupedByClass = {
  class_id: number;
  class_name: string;
  subjects: Array<{ subject_id: number; subject_name: string }>;
};

function normalizePairs(pairs: SubjectClassPair[]): SubjectClassPair[] {
  const seen = new Set<string>();
  const out: SubjectClassPair[] = [];
  for (const p of pairs) {
    const subjectId = parseInt(String(p.subject_id), 10);
    const classId = parseInt(String(p.class_id), 10);
    if (!Number.isFinite(subjectId) || subjectId <= 0 || !Number.isFinite(classId) || classId <= 0) continue;
    const key = `${subjectId}:${classId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ subject_id: subjectId, class_id: classId });
  }
  return out;
}

/** Keep class_teachers / main class pointers aligned with junction class list */
export async function syncTeacherClassAssignments(
  tenantId: number,
  teacherId: number,
  classIds: number[]
): Promise<void> {
  const ids = [...new Set(classIds.filter((id) => Number.isFinite(id) && id > 0))];

  try {
    if (ids.length === 0) {
      await query(`DELETE FROM class_teachers WHERE tenant_id = $1 AND teacher_id = $2`, [tenantId, teacherId]);
      await query(`UPDATE teachers SET class_assigned_id = NULL WHERE id = $1 AND tenant_id = $2`, [
        teacherId,
        tenantId,
      ]);
      return;
    }

    await query(
      `DELETE FROM class_teachers
       WHERE tenant_id = $1 AND teacher_id = $2
         AND NOT (class_id = ANY($3::int[]))`,
      [tenantId, teacherId, ids]
    );

    for (let i = 0; i < ids.length; i++) {
      const classId = ids[i];
      const isMain = i === 0;
      if (isMain) {
        await query(`UPDATE class_teachers SET is_main = false WHERE class_id = $1 AND tenant_id = $2`, [
          classId,
          tenantId,
        ]);
      }
      await query(
        `INSERT INTO class_teachers (tenant_id, class_id, teacher_id, is_main)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (class_id, teacher_id) DO UPDATE SET is_main = EXCLUDED.is_main`,
        [tenantId, classId, teacherId, isMain]
      );
      if (isMain) {
        await query(`UPDATE classes SET assigned_teacher_id = $1 WHERE id = $2 AND tenant_id = $3`, [
          teacherId,
          classId,
          tenantId,
        ]);
      }
    }

    await query(`UPDATE teachers SET class_assigned_id = $1 WHERE id = $2 AND tenant_id = $3`, [
      ids[0],
      teacherId,
      tenantId,
    ]);
  } catch (e: any) {
    if (e?.code === '42P01') return;
    throw e;
  }
}

async function refreshTeacherSubjectsTaught(tenantId: number, teacherId: number): Promise<void> {
  await query(
    `UPDATE teachers t
     SET subjects_taught = COALESCE((
       SELECT array_agg(DISTINCT s.name ORDER BY s.name)
       FROM teacher_subject_classes tsc
       JOIN subjects s ON s.id = tsc.subject_id AND s.tenant_id = tsc.tenant_id
       WHERE tsc.tenant_id = $1 AND tsc.teacher_id = $2
     ), ARRAY[]::text[]),
     updated_at = CURRENT_TIMESTAMP
     WHERE t.id = $2 AND t.tenant_id = $1`,
    [tenantId, teacherId]
  );
}

export async function fetchTeacherSubjectClassRows(
  tenantId: number,
  teacherId: number
): Promise<SubjectClassRow[]> {
  try {
    const result = await query(
      `SELECT tsc.subject_id, s.name AS subject_name, tsc.class_id, c.class_name
       FROM teacher_subject_classes tsc
       JOIN subjects s ON s.id = tsc.subject_id AND s.tenant_id = tsc.tenant_id
       JOIN classes c ON c.id = tsc.class_id AND c.tenant_id = tsc.tenant_id
       WHERE tsc.tenant_id = $1 AND tsc.teacher_id = $2
       ORDER BY s.name, c.class_name`,
      [tenantId, teacherId]
    );
    return result.rows as SubjectClassRow[];
  } catch (e: any) {
    if (e?.code === '42P01') return [];
    throw e;
  }
}

export function groupSubjectClassRows(rows: SubjectClassRow[]): {
  by_subject: GroupedBySubject[];
  by_class: GroupedByClass[];
} {
  const subjectMap = new Map<number, GroupedBySubject>();
  const classMap = new Map<number, GroupedByClass>();

  for (const row of rows) {
    if (!subjectMap.has(row.subject_id)) {
      subjectMap.set(row.subject_id, {
        subject_id: row.subject_id,
        subject_name: row.subject_name,
        classes: [],
      });
    }
    const sg = subjectMap.get(row.subject_id)!;
    if (!sg.classes.some((c) => c.class_id === row.class_id)) {
      sg.classes.push({ class_id: row.class_id, class_name: row.class_name });
    }

    if (!classMap.has(row.class_id)) {
      classMap.set(row.class_id, {
        class_id: row.class_id,
        class_name: row.class_name,
        subjects: [],
      });
    }
    const cg = classMap.get(row.class_id)!;
    if (!cg.subjects.some((s) => s.subject_id === row.subject_id)) {
      cg.subjects.push({ subject_id: row.subject_id, subject_name: row.subject_name });
    }
  }

  return {
    by_subject: [...subjectMap.values()].sort((a, b) => a.subject_name.localeCompare(b.subject_name)),
    by_class: [...classMap.values()].sort((a, b) => a.class_name.localeCompare(b.class_name)),
  };
}

export async function getTeacherSubjectClassesGrouped(tenantId: number, teacherId: number) {
  const rows = await fetchTeacherSubjectClassRows(tenantId, teacherId);
  const grouped = groupSubjectClassRows(rows);
  return { ...grouped, pairs: rows };
}

export async function syncTeacherSubjectClasses(
  tenantId: number,
  teacherId: number,
  pairs: SubjectClassPair[]
): Promise<void> {
  const valid = normalizePairs(pairs);

  try {
    if (valid.length === 0) {
      await query(`DELETE FROM teacher_subject_classes WHERE tenant_id = $1 AND teacher_id = $2`, [
        tenantId,
        teacherId,
      ]);
      await refreshTeacherSubjectsTaught(tenantId, teacherId);
      await syncTeacherClassAssignments(tenantId, teacherId, []);
      return;
    }

    const subjectIds = valid.map((p) => p.subject_id);
    const classIds = valid.map((p) => p.class_id);

    await query(
      `DELETE FROM teacher_subject_classes
       WHERE tenant_id = $1 AND teacher_id = $2
         AND NOT (
           subject_id = ANY($3::int[])
           AND class_id = ANY($4::int[])
           AND (subject_id, class_id) IN (
             SELECT unnest($3::int[]), unnest($4::int[])
           )
         )`,
      [tenantId, teacherId, subjectIds, classIds]
    ).catch(async () => {
      // Fallback for older PG: delete all then re-insert
      await query(`DELETE FROM teacher_subject_classes WHERE tenant_id = $1 AND teacher_id = $2`, [
        tenantId,
        teacherId,
      ]);
    });

    // Simpler reliable sync: delete all, insert all
    await query(`DELETE FROM teacher_subject_classes WHERE tenant_id = $1 AND teacher_id = $2`, [
      tenantId,
      teacherId,
    ]);

    for (const pair of valid) {
      const subjectCheck = await query(
        `SELECT id FROM subjects WHERE id = $1 AND tenant_id = $2`,
        [pair.subject_id, tenantId]
      );
      const classCheck = await query(`SELECT id FROM classes WHERE id = $1 AND tenant_id = $2`, [
        pair.class_id,
        tenantId,
      ]);
      if (subjectCheck.rows.length === 0 || classCheck.rows.length === 0) continue;

      await query(
        `INSERT INTO teacher_subject_classes (tenant_id, teacher_id, subject_id, class_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, teacher_id, subject_id, class_id) DO NOTHING`,
        [tenantId, teacherId, pair.subject_id, pair.class_id]
      );
    }

    await refreshTeacherSubjectsTaught(tenantId, teacherId);
    const uniqueClassIds = [...new Set(valid.map((p) => p.class_id))];
    await syncTeacherClassAssignments(tenantId, teacherId, uniqueClassIds);
  } catch (e: any) {
    if (e?.code === '42P01') return;
    throw e;
  }
}

export async function assignTeacherSubjectClass(
  tenantId: number,
  teacherId: number,
  subjectId: number,
  classId: number
): Promise<void> {
  const subjectCheck = await query(`SELECT id FROM subjects WHERE id = $1 AND tenant_id = $2`, [
    subjectId,
    tenantId,
  ]);
  const classCheck = await query(`SELECT id FROM classes WHERE id = $1 AND tenant_id = $2`, [classId, tenantId]);
  const teacherCheck = await query(`SELECT id FROM teachers WHERE id = $1 AND tenant_id = $2`, [
    teacherId,
    tenantId,
  ]);
  if (subjectCheck.rows.length === 0 || classCheck.rows.length === 0 || teacherCheck.rows.length === 0) {
    throw Object.assign(new Error('Teacher, subject, or class not found'), { status: 404 });
  }

  await query(
    `INSERT INTO teacher_subject_classes (tenant_id, teacher_id, subject_id, class_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, teacher_id, subject_id, class_id) DO NOTHING`,
    [tenantId, teacherId, subjectId, classId]
  );

  await refreshTeacherSubjectsTaught(tenantId, teacherId);
  const rows = await fetchTeacherSubjectClassRows(tenantId, teacherId);
  const uniqueClassIds = [...new Set(rows.map((r) => r.class_id))];
  await syncTeacherClassAssignments(tenantId, teacherId, uniqueClassIds);
}

export async function removeTeacherSubjectClass(
  tenantId: number,
  teacherId: number,
  subjectId: number,
  classId: number
): Promise<void> {
  await query(
    `DELETE FROM teacher_subject_classes
     WHERE tenant_id = $1 AND teacher_id = $2 AND subject_id = $3 AND class_id = $4`,
    [tenantId, teacherId, subjectId, classId]
  );
  await refreshTeacherSubjectsTaught(tenantId, teacherId);
  const rows = await fetchTeacherSubjectClassRows(tenantId, teacherId);
  const uniqueClassIds = [...new Set(rows.map((r) => r.class_id))];
  await syncTeacherClassAssignments(tenantId, teacherId, uniqueClassIds);
}

export async function deleteAllTeacherSubjectClasses(tenantId: number, teacherId: number): Promise<void> {
  await query(`DELETE FROM teacher_subject_classes WHERE tenant_id = $1 AND teacher_id = $2`, [
    tenantId,
    teacherId,
  ]);
}

export async function ensureTeacherSubjectClassesTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS teacher_subject_classes (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, teacher_id, subject_id, class_id)
    )
  `).catch(() => undefined);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_teacher_subject_classes_teacher ON teacher_subject_classes (tenant_id, teacher_id)`
  ).catch(() => undefined);
}
