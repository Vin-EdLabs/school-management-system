import { getClient, query } from '../db/connection.js';
import { getStudentLiveFeeBreakdown } from './studentLiveFeeBreakdownService.js';
import { isJhs3Class } from './academicYearEndService.js';
import { writeAuditLog } from './auditService.js';

export function suggestNextClassName(
  currentName: string,
  classes: Array<{ id: number; class_name: string }>
): number | null {
  const match = String(currentName || '').match(/^(\D*?)(\d+)(.*)$/);
  if (!match) return null;
  const nextLabel = `${match[1]}${parseInt(match[2], 10) + 1}${match[3]}`.trim();
  const found = classes.find((c) => c.class_name.toLowerCase() === nextLabel.toLowerCase());
  return found ? Number(found.id) : null;
}

export async function listClassStudentsForPromotion(tenantId: number, classId: number) {
  const classRes = await query(
    `SELECT id, class_name, level, is_final_class FROM classes WHERE id = $1 AND tenant_id = $2`,
    [classId, tenantId]
  );
  if (!classRes.rows[0]) return null;

  const studentsRes = await query(
    `SELECT s.id, s.first_name, s.last_name, s.student_id, s.passport_photo_url,
            COALESCE(s.enrollment_status, 'active') AS enrollment_status,
            c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id
     WHERE s.tenant_id = $1 AND s.class_assigned_id = $2
       AND COALESCE(s.enrollment_status, 'active') = 'active'
     ORDER BY s.first_name, s.last_name`,
    [tenantId, classId]
  );

  const rows = await Promise.all(
    studentsRes.rows.map(async (row: Record<string, unknown>) => {
      let hasOutstandingBalance = false;
      let outstandingBalance = 0;
      try {
        const breakdown = await getStudentLiveFeeBreakdown(null, tenantId, Number(row.id));
        outstandingBalance = Math.max(0, breakdown?.outstanding ?? 0);
        hasOutstandingBalance = outstandingBalance > 0.01;
      } catch {
        /* non-blocking flag */
      }
      return {
        id: Number(row.id),
        fullName: `${String(row.first_name)} ${String(row.last_name)}`.trim(),
        studentId: String(row.student_id),
        photoUrl: row.passport_photo_url ? String(row.passport_photo_url) : null,
        className: row.class_name ? String(row.class_name) : null,
        status: String(row.enrollment_status || 'active'),
        hasOutstandingBalance,
        outstandingBalance,
      };
    })
  );

  const allClasses = await query(
    `SELECT id, class_name, level, is_final_class FROM classes WHERE tenant_id = $1 ORDER BY class_name`,
    [tenantId]
  );

  const cls = classRes.rows[0];
  const suggestedToClassId = suggestNextClassName(String(cls.class_name), allClasses.rows);
  const isFinalClass = isJhs3Class(cls);

  return {
    class: {
      id: Number(cls.id),
      className: String(cls.class_name),
      level: cls.level ? String(cls.level) : null,
      isFinalClass,
    },
    students: rows,
    suggestedToClassId,
    classes: allClasses.rows.map((c: Record<string, unknown>) => ({
      id: Number(c.id),
      className: String(c.class_name),
      level: c.level ? String(c.level) : null,
      isFinalClass: isJhs3Class(c),
    })),
  };
}

async function graduateStudentInTransaction(
  client: Awaited<ReturnType<typeof getClient>>,
  tenantId: number,
  studentId: number,
  fromClassId: number
) {
  const yearRes = await client.query(
    `SELECT id FROM academic_years WHERE tenant_id = $1 AND is_current = true LIMIT 1`,
    [tenantId]
  );
  const academicYearId = yearRes.rows[0]?.id ? Number(yearRes.rows[0].id) : null;

  if (academicYearId) {
    await client.query(
      `UPDATE student_class_enrollments SET status = 'graduated'
       WHERE tenant_id = $1 AND student_id = $2 AND academic_year_id = $3 AND class_id = $4
         AND status IN ('active', 'repeat')`,
      [tenantId, studentId, academicYearId, fromClassId]
    );
    await client.query(
      `INSERT INTO graduation_details (tenant_id, student_id, class_id, academic_year_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, student_id, academic_year_id) DO NOTHING`,
      [tenantId, studentId, fromClassId, academicYearId]
    );
  }

  await client.query(
    `UPDATE students SET enrollment_status = 'graduated', class_assigned_id = NULL, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [studentId, tenantId]
  );
}

export async function bulkPromoteStudents(opts: {
  tenantId: number;
  promotedBy: number;
  studentIds: number[];
  fromClassId: number;
  toClassId: number | 'GRADUATE';
  academicYear: string;
}) {
  const { tenantId, promotedBy, studentIds, fromClassId, toClassId, academicYear } = opts;
  if (!studentIds.length) {
    throw new Error('No students selected');
  }

  const uniqueIds = [...new Set(studentIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id)))];
  const client = await getClient();
  const failedIds: number[] = [];
  let promotedCount = 0;

  try {
    await client.query('BEGIN');

    const classRes = await client.query(
      `SELECT id, class_name, level FROM classes WHERE id = $1 AND tenant_id = $2`,
      [fromClassId, tenantId]
    );
    if (!classRes.rows[0]) throw new Error('Source class not found');

    if (toClassId === 'GRADUATE') {
      if (!isJhs3Class(classRes.rows[0])) {
        throw new Error('Only final-year (JHS 3) students can be graduated via this action');
      }
    } else {
      const toClass = await client.query(
        `SELECT id FROM classes WHERE id = $1 AND tenant_id = $2`,
        [toClassId, tenantId]
      );
      if (!toClass.rows[0]) throw new Error('Destination class not found');
    }

    for (const studentId of uniqueIds) {
      const check = await client.query(
        `SELECT id FROM students
         WHERE id = $1 AND tenant_id = $2 AND class_assigned_id = $3
           AND COALESCE(enrollment_status, 'active') = 'active'`,
        [studentId, tenantId, fromClassId]
      );
      if (!check.rows[0]) {
        failedIds.push(studentId);
        continue;
      }

      if (toClassId === 'GRADUATE') {
        await graduateStudentInTransaction(client, tenantId, studentId, fromClassId);
        await client.query(
          `INSERT INTO promotion_history
             (tenant_id, student_id, from_class_id, to_class_id, academic_year, promoted_by, action_type)
           VALUES ($1, $2, $3, NULL, $4, $5, 'GRADUATE')`,
          [tenantId, studentId, fromClassId, academicYear, promotedBy]
        );
      } else {
        await client.query(
          `UPDATE students SET class_assigned_id = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND tenant_id = $3`,
          [toClassId, studentId, tenantId]
        );
        await client.query(
          `INSERT INTO promotion_history
             (tenant_id, student_id, from_class_id, to_class_id, academic_year, promoted_by, action_type)
           VALUES ($1, $2, $3, $4, $5, $6, 'PROMOTE')`,
          [tenantId, studentId, fromClassId, toClassId, academicYear, promotedBy]
        );
      }
      promotedCount += 1;
    }

    if (promotedCount === 0) {
      throw new Error('No students could be promoted. Check that they belong to the selected class.');
    }

    await client.query('COMMIT');

    await writeAuditLog({
      tenantId,
      userId: promotedBy,
      userRole: 'administrator',
      action: toClassId === 'GRADUATE' ? 'BULK_GRADUATE' : 'BULK_PROMOTE',
      entityType: 'CLASS',
      entityId: fromClassId,
      module: 'academics',
      summary: `Bulk ${toClassId === 'GRADUATE' ? 'graduation' : 'promotion'}: ${promotedCount} student(s)`,
      details: { studentIds: uniqueIds, fromClassId, toClassId, academicYear, failedIds },
    });

    return { success: true, promotedCount, failedIds: failedIds.map(String) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listPromotionHistory(tenantId: number, limit = 100) {
  const res = await query(
    `SELECT ph.id, ph.student_id, ph.from_class_id, ph.to_class_id, ph.academic_year,
            ph.promoted_at, ph.action_type,
            s.first_name, s.last_name, s.student_id AS student_number,
            fc.class_name AS from_class_name,
            tc.class_name AS to_class_name,
            u.full_name AS promoted_by_name
     FROM promotion_history ph
     JOIN students s ON s.id = ph.student_id
     LEFT JOIN classes fc ON fc.id = ph.from_class_id
     LEFT JOIN classes tc ON tc.id = ph.to_class_id
     LEFT JOIN users u ON u.id = ph.promoted_by
     WHERE ph.tenant_id = $1
     ORDER BY ph.promoted_at DESC
     LIMIT $2`,
    [tenantId, limit]
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    studentId: Number(r.student_id),
    studentName: `${String(r.first_name)} ${String(r.last_name)}`.trim(),
    studentNumber: String(r.student_number),
    fromClassName: r.from_class_name ? String(r.from_class_name) : '—',
    toClassName: r.action_type === 'GRADUATE' ? 'Graduated' : r.to_class_name ? String(r.to_class_name) : '—',
    academicYear: String(r.academic_year || ''),
    promotedAt: new Date(String(r.promoted_at)).toISOString(),
    actionType: String(r.action_type || 'PROMOTE'),
    promotedByName: r.promoted_by_name ? String(r.promoted_by_name) : 'System',
  }));
}
