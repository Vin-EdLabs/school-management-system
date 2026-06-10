import type pg from 'pg';
import { getClient, query } from '../db/connection.js';
import { DEFAULT_CLASS_LEVELS } from '../routes/classLevels.js';

export type EnrollmentStatus = 'active' | 'promoted' | 'repeated' | 'graduated' | 'transferred';

export interface YearEndStudentAction {
  enrollmentId: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  action: 'graduate' | 'promote' | 'repeat';
  fromClassId: number;
  fromClassName: string;
  toClassId?: number;
  toClassName?: string;
}

export interface YearEndClassSummary {
  classId: number;
  className: string;
  levelOrder: number;
  isFinalClass: boolean;
  studentCount: number;
  actions: YearEndStudentAction[];
}

export interface YearEndPreview {
  currentYearId: number;
  currentYearName: string;
  newYearId?: number;
  newYearName?: string;
  classes: YearEndClassSummary[];
  summary: { graduate: number; promote: number; repeat: number };
}

export interface YearEndResult {
  graduated: number;
  promoted: number;
  repeated: number;
  currentYearId: number;
  newYearId: number;
}

type Queryable = Pick<pg.PoolClient, 'query'> | { query: typeof query };

const LEVEL_ORDER_MAP = new Map(DEFAULT_CLASS_LEVELS.map((name, idx) => [name.toLowerCase(), idx]));

export function levelOrderFromName(level: string | null | undefined): number {
  if (!level) return 999;
  const normalized = level.trim().toLowerCase();
  if (LEVEL_ORDER_MAP.has(normalized)) return LEVEL_ORDER_MAP.get(normalized)!;
  const jhs = normalized.match(/^jhs\s*(\d)$/);
  if (jhs) return 10 + parseInt(jhs[1], 10);
  const shs = normalized.match(/^shs\s*(\d)$/);
  if (shs) return 13 + parseInt(shs[1], 10);
  const primary = normalized.match(/^primary\s*(\d)$/);
  if (primary) return 4 + parseInt(primary[1], 10);
  return 999;
}

async function assertSchoolAccess(client: Queryable, tenantId: number, schoolId: number) {
  if (tenantId !== schoolId) {
    throw new Error('Cross-tenant access denied');
  }
  const row = await client.query('SELECT id FROM tenants WHERE id = $1', [schoolId]);
  if (row.rows.length === 0) throw new Error('School not found');
}

async function getYear(client: Queryable, tenantId: number, yearId: number) {
  const res = await client.query(
    'SELECT id, name, status, is_current FROM academic_years WHERE id = $1 AND tenant_id = $2',
    [yearId, tenantId]
  );
  if (res.rows.length === 0) throw new Error('Academic year not found');
  return res.rows[0] as { id: number; name: string; status: string; is_current: boolean };
}

async function loadClasses(client: Queryable, tenantId: number) {
  const res = await client.query(
    `SELECT id, class_name, level, COALESCE(level_order, 999) AS level_order, is_final_class
     FROM classes WHERE tenant_id = $1
     ORDER BY COALESCE(level_order, 999) DESC, class_name`,
    [tenantId]
  );
  return res.rows.map((row) => ({
    id: Number(row.id),
    className: String(row.class_name || ''),
    level: row.level as string | null,
    levelOrder: Number(row.level_order),
    isFinalClass: row.is_final_class === true,
  }));
}

function findNextClass(
  classes: Awaited<ReturnType<typeof loadClasses>>,
  currentLevelOrder: number,
  currentClassId: number
) {
  const candidates = classes
    .filter((c) => c.levelOrder > currentLevelOrder && c.id !== currentClassId)
    .sort((a, b) => a.levelOrder - b.levelOrder);
  return candidates[0] ?? null;
}

async function loadActiveEnrollments(client: Queryable, tenantId: number, yearId: number) {
  const res = await client.query(
    `SELECT e.id AS enrollment_id, e.student_id, e.class_id, e.status,
            s.first_name, s.last_name, s.student_id AS student_code,
            c.class_name, COALESCE(c.level_order, 999) AS level_order, c.is_final_class
     FROM student_class_enrollments e
     JOIN students s ON s.id = e.student_id AND s.tenant_id = e.tenant_id
     JOIN classes c ON c.id = e.class_id AND c.tenant_id = e.tenant_id
     WHERE e.tenant_id = $1 AND e.academic_year_id = $2
       AND e.status IN ('active', 'repeat')
       AND COALESCE(s.enrollment_status, 'active') = 'active'`,
    [tenantId, yearId]
  );
  return res.rows;
}

function buildPreviewFromEnrollments(
  classes: Awaited<ReturnType<typeof loadClasses>>,
  enrollments: Awaited<ReturnType<typeof loadActiveEnrollments>>,
  currentYear: { id: number; name: string }
): YearEndPreview {
  const classMap = new Map<number, YearEndClassSummary>();

  for (const cls of classes) {
    classMap.set(cls.id, {
      classId: cls.id,
      className: cls.className,
      levelOrder: cls.levelOrder,
      isFinalClass: cls.isFinalClass,
      studentCount: 0,
      actions: [],
    });
  }

  let graduate = 0;
  let promote = 0;
  let repeat = 0;

  for (const row of enrollments) {
    const classId = Number(row.class_id);
    const bucket = classMap.get(classId);
    if (!bucket) continue;

    const studentName = `${row.first_name} ${row.last_name}`.trim();
    const studentCode = String(row.student_code || '');
    const isRepeat = row.status === 'repeat';
    const isFinal = row.is_final_class === true;

    let action: YearEndStudentAction;

    if (isRepeat) {
      action = {
        enrollmentId: Number(row.enrollment_id),
        studentId: Number(row.student_id),
        studentName,
        studentCode,
        action: 'repeat',
        fromClassId: classId,
        fromClassName: String(row.class_name),
        toClassId: classId,
        toClassName: String(row.class_name),
      };
      repeat += 1;
    } else if (isFinal) {
      action = {
        enrollmentId: Number(row.enrollment_id),
        studentId: Number(row.student_id),
        studentName,
        studentCode,
        action: 'graduate',
        fromClassId: classId,
        fromClassName: String(row.class_name),
      };
      graduate += 1;
    } else {
      const next = findNextClass(classes, Number(row.level_order), classId);
      action = {
        enrollmentId: Number(row.enrollment_id),
        studentId: Number(row.student_id),
        studentName,
        studentCode,
        action: 'promote',
        fromClassId: classId,
        fromClassName: String(row.class_name),
        toClassId: next?.id,
        toClassName: next?.className,
      };
      if (!next) {
        throw new Error(`No promotion target for class "${row.class_name}". Add the next level class or mark students to repeat.`);
      }
      promote += 1;
    }

    bucket.studentCount += 1;
    bucket.actions.push(action);
  }

  return {
    currentYearId: currentYear.id,
    currentYearName: currentYear.name,
    classes: [...classMap.values()].filter((c) => c.studentCount > 0 || c.isFinalClass),
    summary: { graduate, promote, repeat },
  };
}

export async function previewYearEnd(tenantId: number, schoolId: number, currentYearId: number): Promise<YearEndPreview> {
  await assertSchoolAccess({ query }, tenantId, schoolId);
  const currentYear = await getYear({ query }, schoolId, currentYearId);
  const classes = await loadClasses({ query }, schoolId);
  const enrollments = await loadActiveEnrollments({ query }, schoolId, currentYearId);
  return buildPreviewFromEnrollments(classes, enrollments, currentYear);
}

export async function listAcademicYears(tenantId: number, schoolId: number) {
  await assertSchoolAccess({ query }, tenantId, schoolId);
  const res = await query(
    `SELECT id, name, start_date, end_date, status, is_current, created_at
     FROM academic_years WHERE tenant_id = $1 ORDER BY COALESCE(start_date, created_at::date) DESC, name DESC`,
    [schoolId]
  );
  return res.rows;
}

export async function createAcademicYear(
  tenantId: number,
  schoolId: number,
  payload: { name: string; startDate?: string; endDate?: string }
) {
  await assertSchoolAccess({ query }, tenantId, schoolId);
  const name = payload.name.trim();
  if (!name) throw new Error('Academic year name is required');

  const res = await query(
    `INSERT INTO academic_years (tenant_id, name, start_date, end_date, status, is_current)
     VALUES ($1, $2, $3, $4, 'active', false)
     RETURNING id, name, start_date, end_date, status, is_current`,
    [schoolId, name, payload.startDate || null, payload.endDate || null]
  );
  return res.rows[0];
}

export async function markEnrollmentRepeat(
  tenantId: number,
  enrollmentId: number
): Promise<{ id: number; status: EnrollmentStatus }> {
  const res = await query(
    `UPDATE student_class_enrollments e
     SET status = 'repeat'
     FROM academic_years ay
     WHERE e.id = $1 AND e.tenant_id = $2
       AND ay.id = e.academic_year_id AND ay.tenant_id = e.tenant_id
       AND ay.status = 'active'
       AND e.status = 'active'
     RETURNING e.id, e.status`,
    [enrollmentId, tenantId]
  );
  if (res.rows.length === 0) {
    throw new Error('Enrollment not found or cannot be marked to repeat');
  }
  return { id: Number(res.rows[0].id), status: res.rows[0].status as EnrollmentStatus };
}

export async function unmarkEnrollmentRepeat(
  tenantId: number,
  enrollmentId: number
): Promise<{ id: number; status: EnrollmentStatus }> {
  const res = await query(
    `UPDATE student_class_enrollments
     SET status = 'active'
     WHERE id = $1 AND tenant_id = $2 AND status = 'repeat'
     RETURNING id, status`,
    [enrollmentId, tenantId]
  );
  if (res.rows.length === 0) {
    throw new Error('Enrollment not found or is not marked to repeat');
  }
  return { id: Number(res.rows[0].id), status: res.rows[0].status as EnrollmentStatus };
}

export async function executeYearEnd(
  tenantId: number,
  schoolId: number,
  currentYearId: number,
  newYearId: number
): Promise<YearEndResult> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await assertSchoolAccess(client, tenantId, schoolId);

    const currentYear = await getYear(client, schoolId, currentYearId);
    const newYear = await getYear(client, schoolId, newYearId);

    if (currentYear.status === 'closed') {
      throw new Error('Current academic year is already closed');
    }
    if (newYear.id === currentYear.id) {
      throw new Error('New academic year must be different from the current year');
    }

    const classes = await loadClasses(client, schoolId);
    const enrollments = await loadActiveEnrollments(client, schoolId, currentYearId);
    const preview = buildPreviewFromEnrollments(classes, enrollments, currentYear);

    let graduated = 0;
    let promoted = 0;
    let repeated = 0;

    for (const classSummary of preview.classes) {
      for (const action of classSummary.actions) {
        const oldStatus: EnrollmentStatus =
          action.action === 'graduate' ? 'graduated' : action.action === 'repeat' ? 'repeated' : 'promoted';

        await client.query(
          `UPDATE student_class_enrollments SET status = $1 WHERE id = $2 AND tenant_id = $3`,
          [oldStatus, action.enrollmentId, schoolId]
        );

        if (action.action === 'graduate') {
          await client.query(
            `INSERT INTO graduation_details (tenant_id, student_id, class_id, academic_year_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (tenant_id, student_id, academic_year_id) DO NOTHING`,
            [schoolId, action.studentId, action.fromClassId, currentYearId]
          );
          await client.query(
            `UPDATE students SET enrollment_status = 'graduated', class_assigned_id = NULL, updated_at = NOW()
             WHERE id = $1 AND tenant_id = $2`,
            [action.studentId, schoolId]
          );
          graduated += 1;
        } else {
          const targetClassId = action.toClassId!;
          await client.query(
            `INSERT INTO student_class_enrollments (tenant_id, student_id, class_id, academic_year_id, status)
             VALUES ($1, $2, $3, $4, 'active')
             ON CONFLICT (tenant_id, student_id, academic_year_id, class_id) DO NOTHING`,
            [schoolId, action.studentId, targetClassId, newYearId]
          );
          await client.query(
            `UPDATE students SET class_assigned_id = $1, enrollment_status = 'active', updated_at = NOW()
             WHERE id = $2 AND tenant_id = $3`,
            [targetClassId, action.studentId, schoolId]
          );
          if (action.action === 'repeat') repeated += 1;
          else promoted += 1;
        }
      }
    }

    await client.query(
      `UPDATE academic_years SET status = 'closed', is_current = false WHERE tenant_id = $1 AND id = $2`,
      [schoolId, currentYearId]
    );
    await client.query(
      `UPDATE academic_years SET status = 'active', is_current = true WHERE tenant_id = $1 AND id = $2`,
      [schoolId, newYearId]
    );
    await client.query(
      `UPDATE academic_years SET is_current = false WHERE tenant_id = $1 AND id != $2`,
      [schoolId, newYearId]
    );

    await client.query(
      `UPDATE school_settings SET current_year = $1, updated_at = NOW() WHERE tenant_id = $2`,
      [newYear.name, schoolId]
    );

    await client.query('COMMIT');
    return { graduated, promoted, repeated, currentYearId, newYearId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getEnrollmentsForYear(tenantId: number, academicYearId: number, classId?: number) {
  const params: unknown[] = [tenantId, academicYearId];
  let sql = `
    SELECT e.id, e.student_id, e.class_id, e.status, e.academic_year_id, e.created_at,
           s.first_name, s.last_name, s.student_id AS student_code, s.enrollment_status,
           c.class_name, ay.name AS academic_year_name
    FROM student_class_enrollments e
    JOIN students s ON s.id = e.student_id AND s.tenant_id = e.tenant_id
    JOIN classes c ON c.id = e.class_id AND c.tenant_id = e.tenant_id
    JOIN academic_years ay ON ay.id = e.academic_year_id
    WHERE e.tenant_id = $1 AND e.academic_year_id = $2
  `;
  if (classId) {
    params.push(classId);
    sql += ` AND e.class_id = $3`;
  }
  sql += ' ORDER BY c.class_name, s.last_name, s.first_name';
  const res = await query(sql, params);
  return res.rows;
}

export async function ensureEnrollmentForStudent(
  tenantId: number,
  studentId: number,
  classId: number,
  academicYearId: number
) {
  await query(
    `INSERT INTO student_class_enrollments (tenant_id, student_id, class_id, academic_year_id, status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (tenant_id, student_id, academic_year_id, class_id) DO NOTHING`,
    [tenantId, studentId, classId, academicYearId]
  );
}

export async function getCurrentAcademicYearId(tenantId: number): Promise<number | null> {
  const res = await query(
    `SELECT id FROM academic_years WHERE tenant_id = $1 AND is_current = true LIMIT 1`,
    [tenantId]
  );
  return res.rows[0]?.id ? Number(res.rows[0].id) : null;
}

/** True only for JHS 3 (final junior high) — alumni promotion is limited to this level. */
export function isJhs3Class(row: {
  level?: string | null;
  class_name?: string | null;
  className?: string | null;
  is_final_class?: boolean;
  isFinalClass?: boolean;
}): boolean {
  const hay = `${row.level || ''} ${row.class_name || row.className || ''}`.toLowerCase();
  if (/\bjhs\s*3\b/.test(hay) || hay.includes('jhs3')) return true;
  if (/\bjhs\s*iii\b/.test(hay)) return true;
  return false;
}

export async function graduateClassToAlumni(
  tenantId: number,
  classId: number
): Promise<{ graduated: number; className: string }> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const classRes = await client.query(
      `SELECT id, class_name, level, is_final_class FROM classes WHERE id = $1 AND tenant_id = $2`,
      [classId, tenantId]
    );
    if (classRes.rows.length === 0) throw new Error('Class not found');
    const classRow = classRes.rows[0];
    if (!isJhs3Class(classRow)) {
      throw new Error('Only JHS 3 classes can be moved to Alumni. Select a JHS 3 class.');
    }

    const yearRes = await client.query(
      `SELECT id FROM academic_years WHERE tenant_id = $1 AND is_current = true LIMIT 1`,
      [tenantId]
    );
    const academicYearId = yearRes.rows[0]?.id ? Number(yearRes.rows[0].id) : null;

    const studentsRes = await client.query(
      `SELECT id, first_name, last_name FROM students
       WHERE tenant_id = $1 AND class_assigned_id = $2
         AND COALESCE(enrollment_status, 'active') = 'active'`,
      [tenantId, classId]
    );

    if (studentsRes.rows.length === 0) {
      throw new Error('No active students in this class to graduate.');
    }

    let graduated = 0;
    for (const student of studentsRes.rows) {
      const studentId = Number(student.id);
      if (academicYearId) {
        await client.query(
          `UPDATE student_class_enrollments SET status = 'graduated'
           WHERE tenant_id = $1 AND student_id = $2 AND academic_year_id = $3 AND class_id = $4
             AND status IN ('active', 'repeat')`,
          [tenantId, studentId, academicYearId, classId]
        );
        if (academicYearId) {
          await client.query(
            `INSERT INTO graduation_details (tenant_id, student_id, class_id, academic_year_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (tenant_id, student_id, academic_year_id) DO NOTHING`,
            [tenantId, studentId, classId, academicYearId]
          );
        }
      }
      await client.query(
        `UPDATE students SET enrollment_status = 'graduated', class_assigned_id = NULL, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [studentId, tenantId]
      );
      graduated += 1;
    }

    await client.query('COMMIT');
    return { graduated, className: String(classRow.class_name || 'JHS 3') };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
