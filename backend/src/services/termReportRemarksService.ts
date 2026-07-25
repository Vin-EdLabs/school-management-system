import { query } from '../db/connection.js';
import {
  buildFullTermLabel,
  getSchoolActiveTermYear,
  normalizeTermOnly,
} from './gradesTermContext.js';

/** Empty string — never NULL (PostgreSQL UNIQUE treats NULLs as distinct). */
export const TERM_REPORT_REMARK_SUBJECT = '';

export type TermReportRemarkRow = {
  student_id: number;
  remark_type: string;
  remark: string;
};

export type SchoolTermYear = {
  term: string;
  academicYear: string;
  fullTermLabel: string;
};

export async function getSchoolTermYear(tenantId: number): Promise<SchoolTermYear> {
  const active = await getSchoolActiveTermYear(tenantId);
  return {
    term: active.term,
    academicYear: active.academicYear,
    fullTermLabel: active.fullTermLabel,
  };
}

/** Match rows stored with term-only or full combined labels (e.g. Term 1 vs Term 1 2024/2025). */
function termMatchSql(alias: string, termOnlyParam: string, yearParam: string, fullTermParam: string): string {
  return `AND ${alias}.academic_year = ${yearParam} AND (${alias}.term = ${termOnlyParam} OR ${alias}.term = ${fullTermParam})`;
}

/** Latest remark per student + type for a class/term. */
export async function loadClassTermRemarks(
  tenantId: number,
  classId: number,
  term: string,
  academicYear: string
): Promise<{ teacherRemarks: Record<number, string>; headmasterRemarks: Record<number, string> }> {
  const termOnly = normalizeTermOnly(term, academicYear) || term.trim();
  const fullTermLabel = buildFullTermLabel(termOnly, academicYear);

  const remarksRes = await query(
    `SELECT DISTINCT ON (student_id, remark_type)
            student_id, remark_type, remark
     FROM term_report_comments
     WHERE tenant_id = $1
       AND class_id = $2
       ${termMatchSql('term_report_comments', '$3', '$4', '$5')}
       AND COALESCE(subject, '') = $6
     ORDER BY student_id, remark_type, updated_at DESC`,
    [tenantId, classId, termOnly, academicYear, fullTermLabel, TERM_REPORT_REMARK_SUBJECT]
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
  const termOnly = normalizeTermOnly(term, academicYear) || term.trim();
  const fullTermLabel = buildFullTermLabel(termOnly, academicYear);

  const remarksRes = await query(
    `SELECT remark_type, remark
     FROM term_report_comments
     WHERE tenant_id = $1
       AND class_id = $2
       AND student_id = $3
       ${termMatchSql('term_report_comments', '$4', '$5', '$6')}
       AND COALESCE(subject, '') = $7
     ORDER BY updated_at DESC`,
    [tenantId, classId, studentId, termOnly, academicYear, fullTermLabel, TERM_REPORT_REMARK_SUBJECT]
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
  termOnly: string,
  academicYear: string,
  fullTermLabel: string,
  remarkType: 'teacher' | 'headmaster'
): Promise<void> {
  await query(
    `DELETE FROM term_report_comments a
     USING term_report_comments b
     WHERE a.tenant_id = b.tenant_id
       AND a.student_id = b.student_id
       AND a.class_id = b.class_id
       AND a.academic_year = b.academic_year
       AND a.remark_type = b.remark_type
       AND a.id < b.id
       AND a.tenant_id = $1
       AND a.class_id = $2
       AND a.student_id = $3
       AND a.academic_year = $4
       AND (a.term = $5 OR a.term = $6)
       AND (b.term = $5 OR b.term = $6)
       AND a.remark_type = $7`,
    [tenantId, classId, studentId, academicYear, termOnly, fullTermLabel, remarkType]
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
  const termOnly = normalizeTermOnly(term, academicYear) || term.trim();
  const fullTermLabel = buildFullTermLabel(termOnly, academicYear);

  await dedupeStudentTermRemarkRows(
    tenantId,
    classId,
    studentId,
    termOnly,
    academicYear,
    fullTermLabel,
    remarkType
  );

  const updated = await query(
    `UPDATE term_report_comments
     SET remark = $8,
         term = $9,
         subject = $10,
         updated_by = $11,
         updated_at = NOW()
     WHERE tenant_id = $1
       AND class_id = $2
       AND student_id = $3
       AND academic_year = $4
       AND (term = $5 OR term = $6)
       AND remark_type = $7`,
    [
      tenantId,
      classId,
      studentId,
      academicYear,
      termOnly,
      fullTermLabel,
      remarkType,
      remark,
      termOnly,
      TERM_REPORT_REMARK_SUBJECT,
      userId,
    ]
  );

  if ((updated.rowCount ?? 0) > 0) return;

  await query(
    `INSERT INTO term_report_comments
       (tenant_id, class_id, student_id, term, academic_year, subject, remark_type, remark, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [tenantId, classId, studentId, termOnly, academicYear, TERM_REPORT_REMARK_SUBJECT, remarkType, remark, userId]
  );
}
