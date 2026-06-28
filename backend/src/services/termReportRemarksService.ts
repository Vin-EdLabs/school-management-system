import { query } from '../db/connection.js';

/** Empty string — never NULL (PostgreSQL UNIQUE treats NULLs as distinct). */
export const TERM_REPORT_REMARK_SUBJECT = '';

export type TermReportRemarkRow = {
  student_id: number;
  remark_type: string;
  remark: string;
};

export async function getSchoolTermYear(tenantId: number) {
  const res = await query(
    `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  return {
    term: String(res.rows[0]?.current_term || '').trim(),
    academicYear: String(res.rows[0]?.current_year || '').trim(),
  };
}

/** Latest remark per student + type for a class/term. */
export async function loadClassTermRemarks(
  tenantId: number,
  classId: number,
  term: string,
  academicYear: string
): Promise<{ teacherRemarks: Record<number, string>; headmasterRemarks: Record<number, string> }> {
  const remarksRes = await query(
    `SELECT DISTINCT ON (student_id, remark_type)
            student_id, remark_type, remark
     FROM term_report_comments
     WHERE tenant_id = $1
       AND class_id = $2
       AND term = $3
       AND academic_year = $4
       AND COALESCE(subject, '') = $5
     ORDER BY student_id, remark_type, updated_at DESC`,
    [tenantId, classId, term, academicYear, TERM_REPORT_REMARK_SUBJECT]
  );

  const teacherRemarks: Record<number, string> = {};
  const headmasterRemarks: Record<number, string> = {};
  for (const row of remarksRes.rows as TermReportRemarkRow[]) {
    if (row.remark_type === 'teacher') teacherRemarks[row.student_id] = row.remark || '';
    if (row.remark_type === 'headmaster') headmasterRemarks[row.student_id] = row.remark || '';
  }
  return { teacherRemarks, headmasterRemarks };
}

export async function loadStudentTermRemarks(
  tenantId: number,
  classId: number,
  studentId: number,
  term: string,
  academicYear: string
): Promise<{ teacherRemark: string; headmasterRemark: string }> {
  const remarksRes = await query(
    `SELECT remark_type, remark
     FROM term_report_comments
     WHERE tenant_id = $1
       AND class_id = $2
       AND student_id = $3
       AND term = $4
       AND academic_year = $5
       AND COALESCE(subject, '') = $6
     ORDER BY updated_at DESC`,
    [tenantId, classId, studentId, term, academicYear, TERM_REPORT_REMARK_SUBJECT]
  );

  const result = { teacherRemark: '', headmasterRemark: '' };
  const seen = new Set<string>();
  for (const row of remarksRes.rows) {
    if (row.remark_type === 'teacher' && !seen.has('teacher')) {
      result.teacherRemark = row.remark || '';
      seen.add('teacher');
    }
    if (row.remark_type === 'headmaster' && !seen.has('headmaster')) {
      result.headmasterRemark = row.remark || '';
      seen.add('headmaster');
    }
  }
  return result;
}

/** Remove legacy duplicate rows (NULL vs '' subject) — keep newest per student + remark type. */
async function dedupeStudentTermRemarkRows(
  tenantId: number,
  classId: number,
  studentId: number,
  term: string,
  academicYear: string,
  remarkType: 'teacher' | 'headmaster'
): Promise<void> {
  await query(
    `DELETE FROM term_report_comments a
     USING term_report_comments b
     WHERE a.tenant_id = b.tenant_id
       AND a.student_id = b.student_id
       AND a.class_id = b.class_id
       AND a.term = b.term
       AND a.academic_year = b.academic_year
       AND a.remark_type = b.remark_type
       AND a.id < b.id
       AND a.tenant_id = $1
       AND a.class_id = $2
       AND a.student_id = $3
       AND a.term = $4
       AND a.academic_year = $5
       AND a.remark_type = $6`,
    [tenantId, classId, studentId, term, academicYear, remarkType]
  );
}

export async function upsertTermReportRemark(
  tenantId: number,
  classId: number,
  studentId: number,
  term: string,
  academicYear: string,
  remarkType: 'teacher' | 'headmaster',
  remark: string,
  userId: number
): Promise<void> {
  await dedupeStudentTermRemarkRows(tenantId, classId, studentId, term, academicYear, remarkType);

  const updated = await query(
    `UPDATE term_report_comments
     SET remark = $8,
         subject = $6,
         updated_by = $9,
         updated_at = NOW()
     WHERE tenant_id = $1
       AND class_id = $2
       AND student_id = $3
       AND term = $4
       AND academic_year = $5
       AND remark_type = $7`,
    [tenantId, classId, studentId, term, academicYear, TERM_REPORT_REMARK_SUBJECT, remarkType, remark, userId]
  );

  if ((updated.rowCount ?? 0) > 0) return;

  await query(
    `INSERT INTO term_report_comments
       (tenant_id, class_id, student_id, term, academic_year, subject, remark_type, remark, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [tenantId, classId, studentId, term, academicYear, TERM_REPORT_REMARK_SUBJECT, remarkType, remark, userId]
  );
}
