import { query } from '../db/connection.js';
import { resolveSchoolDisplayName } from './schoolBrandingService.js';
import { getSchoolActiveTermYear } from './gradesTermContext.js';
import { loadClassTermRemarks } from './termReportRemarksService.js';

export type ArchiveSignatures = {
  classTeacherSig?: string | null;
  headTeacherSig?: string | null;
  headmasterTitle?: string | null;
  headmasterName?: string | null;
};

export type TermReportStudentRow = {
  studentId: number;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  passportPhotoUrl: string | null;
  hasMoved: boolean;
  subjectScores: Record<string, {
    score: number;
    maxScore: number;
    classScore: number;
    examScore: number;
  }>;
  grandTotal: number;
  grandMax: number;
  percentage: number;
  position: number;
};

export type BuiltTermReport = {
  students: TermReportStudentRow[];
  subjects: string[];
  assignments: unknown[];
  assignmentsBySubject: Record<string, unknown[]>;
  className: string;
  classId: number;
  currentTerm: string;
  currentYear: string;
  schoolName: string;
  schoolLogoUrl: string | null;
  gradeScale: Array<{ letter: string; minPct: number; maxPct: number; description?: string }>;
  teacherRemarks: Record<number, string>;
  headmasterRemarks: Record<number, string>;
  headmasterName: string | null;
  headmasterTitle: string;
  attendanceSummary: Record<number, { present: number; totalDays: number }>;
  classAttendanceTotalDays: number;
  releasedAt: string | null;
};

function parseTeacherRemarkBundle(raw: string) {
  try {
    if (raw && raw.trim().startsWith('{')) {
      const parsed = JSON.parse(raw);
      const clean = (field: string, value: unknown) => {
        const s = String(value ?? '').trim();
        if (!s) return '';
        const legacy: Record<string, Set<string>> = {
          conduct: new Set(['Humble']),
          attitude: new Set(['Dependable']),
          interest: new Set(['Sports']),
          reopeningDate: new Set(['21st April, 2026']),
        };
        if (legacy[field]?.has(s)) return '';
        return s;
      };
      return {
        text: String(parsed.text ?? '').trim(),
        conduct: clean('conduct', parsed.conduct),
        attitude: clean('attitude', parsed.attitude),
        interest: clean('interest', parsed.interest),
        attendance: String(parsed.attendance ?? '').trim(),
        attendanceOutOf: String(parsed.attendanceOutOf ?? '').trim(),
        promotedTo: String(parsed.promotedTo ?? '').trim(),
        reopeningDate: clean('reopeningDate', parsed.reopeningDate),
      };
    }
  } catch {
    /* fallback */
  }
  return {
    text: String(raw ?? '').trim(),
    conduct: '',
    attitude: '',
    interest: '',
    attendance: '',
    attendanceOutOf: '',
    promotedTo: '',
    reopeningDate: '',
  };
}

export async function buildTermReportData(
  tenantId: number,
  classId: number,
  termOverride?: string,
  yearOverride?: string
): Promise<BuiltTermReport | null> {
  const active = termOverride && yearOverride
    ? { term: termOverride, academicYear: yearOverride }
    : await getSchoolActiveTermYear(tenantId);

  const assignmentsRes = await query(
    `SELECT id, subject, name, assignment_type, max_score
     FROM grade_assignments
     WHERE tenant_id = $1 AND class_id = $2 AND term = $3 AND academic_year = $4
     ORDER BY subject, assignment_type, name`,
    [tenantId, classId, active.term, active.academicYear]
  );
  const assignments: any[] = assignmentsRes.rows;
  if (assignments.length === 0) return null;

  const classRes = await query(
    'SELECT class_name FROM classes WHERE id = $1 AND tenant_id = $2',
    [classId, tenantId]
  );
  const className = classRes.rows[0]?.class_name || '';

  const studentsRes = await query(
    `SELECT id, first_name, last_name, student_id AS admission_number, passport_photo_url
     FROM students
     WHERE tenant_id = $1 AND class_assigned_id = $2
     ORDER BY first_name, last_name`,
    [tenantId, classId]
  );

  const assignmentIds = assignments.map((a: any) => a.id);
  const gradedStudentsRes = await query(
    `SELECT DISTINCT s.id, s.first_name, s.last_name, s.student_id AS admission_number,
            s.passport_photo_url
     FROM student_grades sg
     JOIN students s ON sg.student_id = s.id AND s.tenant_id = sg.tenant_id
     WHERE sg.tenant_id = $1 AND sg.assignment_id = ANY($2)`,
    [tenantId, assignmentIds]
  );

  const studentMap = new Map<number, any>();
  for (const s of studentsRes.rows) studentMap.set(s.id, { ...s, hasMoved: false });
  for (const s of gradedStudentsRes.rows) {
    if (!studentMap.has(s.id)) studentMap.set(s.id, { ...s, hasMoved: true });
  }
  const allStudents = Array.from(studentMap.values());

  const gradesRes = await query(
    `SELECT student_id, assignment_id, score::float AS score
     FROM student_grades
     WHERE tenant_id = $1 AND assignment_id = ANY($2)`,
    [tenantId, assignmentIds]
  );

  const gradeMap: Record<number, Record<number, number>> = {};
  for (const g of gradesRes.rows) {
    if (!gradeMap[g.student_id]) gradeMap[g.student_id] = {};
    gradeMap[g.student_id][g.assignment_id] = g.score;
  }

  const subjectOrder: string[] = [];
  for (const a of assignments) {
    if (!subjectOrder.includes(a.subject)) subjectOrder.push(a.subject);
  }

  const assignmentsBySubject: Record<string, any[]> = {};
  for (const subj of subjectOrder) {
    assignmentsBySubject[subj] = assignments.filter((a: any) => a.subject === subj);
  }

  const reportRows: TermReportStudentRow[] = allStudents.map((s: any) => {
    const subjectScores: TermReportStudentRow['subjectScores'] = {};
    let grandTotal = 0;
    let grandMax = 0;

    for (const subj of subjectOrder) {
      const subjectAssignments = assignmentsBySubject[subj];
      let classScoreSum = 0;
      let classMaxSum = 0;
      let examScoreSum = 0;
      let examMaxSum = 0;

      for (const a of subjectAssignments) {
        const scored = gradeMap[s.id]?.[a.id] ?? 0;
        const typeLabel = String(a.assignment_type || a.name || '').toLowerCase();
        const isExam = typeLabel === 'exam' || typeLabel.includes('exam');
        if (isExam) {
          examScoreSum += scored;
          examMaxSum += parseFloat(a.max_score);
        } else {
          classScoreSum += scored;
          classMaxSum += parseFloat(a.max_score);
        }
      }

      let classScoreVal = 0;
      let examScoreVal = 0;

      if (classMaxSum > 0 && examMaxSum > 0) {
        classScoreVal = (classScoreSum / classMaxSum) * 40;
        examScoreVal = (examScoreSum / examMaxSum) * 60;
      } else if (classMaxSum > 0) {
        const pct = classScoreSum / classMaxSum;
        classScoreVal = pct * 40;
        examScoreVal = pct * 60;
      } else if (examMaxSum > 0) {
        const pct = examScoreSum / examMaxSum;
        classScoreVal = pct * 40;
        examScoreVal = pct * 60;
      }

      const totalScore = classScoreVal + examScoreVal;
      subjectScores[subj] = {
        score: Math.round(totalScore * 10) / 10,
        maxScore: 100,
        classScore: Math.round(classScoreVal * 10) / 10,
        examScore: Math.round(examScoreVal * 10) / 10,
      };
      grandTotal += totalScore;
      grandMax += 100;
    }

    return {
      studentId: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      admissionNumber: s.admission_number,
      passportPhotoUrl: s.passport_photo_url || null,
      hasMoved: s.hasMoved,
      subjectScores,
      grandTotal: Math.round(grandTotal * 10) / 10,
      grandMax: Math.round(grandMax * 10) / 10,
      percentage: grandMax > 0 ? Math.round((grandTotal / grandMax) * 100) : 0,
      position: 0,
    };
  });

  reportRows.sort((a, b) => b.grandTotal - a.grandTotal);
  let pos = 1;
  for (let i = 0; i < reportRows.length; i++) {
    if (i > 0 && reportRows[i].grandTotal < reportRows[i - 1].grandTotal) pos = i + 1;
    reportRows[i].position = pos;
  }

  const settingsRes = await query(
    `SELECT current_term, current_year, grade_scale, logo_url
     FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const currentTerm = termOverride || settingsRes.rows[0]?.current_term || active.term || '';
  const currentYear = yearOverride || settingsRes.rows[0]?.current_year || active.academicYear || '';
  const schoolName = await resolveSchoolDisplayName(tenantId);
  const schoolLogoUrl = settingsRes.rows[0]?.logo_url || null;
  const gradeScale = settingsRes.rows[0]?.grade_scale || [
    { letter: 'A', minPct: 80, maxPct: 100, description: 'Excellent' },
    { letter: 'B', minPct: 70, maxPct: 79, description: 'Good' },
    { letter: 'C', minPct: 60, maxPct: 69, description: 'Fair' },
    { letter: 'D', minPct: 50, maxPct: 59, description: 'Pass' },
    { letter: 'F', minPct: 0, maxPct: 49, description: 'Fail' },
  ];

  const { teacherRemarks, headmasterRemarks } = await loadClassTermRemarks(
    tenantId,
    classId,
    currentTerm,
    currentYear
  );

  const headmasterRes = await query(
    `SELECT COALESCE(t.full_name, u.full_name) AS full_name,
            COALESCE(NULLIF(TRIM(t.headmaster_title), ''), 'Headmaster') AS headmaster_title
     FROM users u
     LEFT JOIN teachers t ON t.id::text = u.teacher_id::text AND t.tenant_id = u.tenant_id
     WHERE u.tenant_id = $1 AND u.role = 'headmaster' AND u.is_active = true
     ORDER BY u.id ASC
     LIMIT 1`,
    [tenantId]
  ).catch(() => ({ rows: [] as any[] }));

  const headmasterName = headmasterRes.rows[0]?.full_name || null;
  const headmasterTitle = headmasterRes.rows[0]?.headmaster_title || 'Headmaster';

  const releaseRes = await query(
    `SELECT released_at FROM term_report_releases
     WHERE tenant_id = $1 AND class_id = $2 AND term = $3 AND is_released = true`,
    [tenantId, classId, currentTerm]
  );

  const classDaysRes = await query(
    `SELECT COUNT(DISTINCT attendance_date)::int AS total_days
     FROM attendance WHERE tenant_id = $1 AND class_id = $2`,
    [tenantId, classId]
  );
  const classAttendanceTotalDays = classDaysRes.rows[0]?.total_days ?? 0;

  const attendanceRes = await query(
    `SELECT student_id,
            COUNT(*)::int AS total_days,
            SUM(CASE WHEN present THEN 1 ELSE 0 END)::int AS present_count
     FROM attendance
     WHERE tenant_id = $1 AND class_id = $2
     GROUP BY student_id`,
    [tenantId, classId]
  );
  const attendanceSummary: Record<number, { present: number; totalDays: number }> = {};
  for (const row of attendanceRes.rows) {
    attendanceSummary[row.student_id] = {
      present: row.present_count ?? 0,
      totalDays: row.total_days ?? classAttendanceTotalDays,
    };
  }

  return {
    students: reportRows,
    subjects: subjectOrder,
    assignments,
    assignmentsBySubject,
    className,
    classId,
    currentTerm,
    currentYear,
    schoolName,
    schoolLogoUrl,
    gradeScale,
    teacherRemarks,
    headmasterRemarks,
    headmasterName,
    headmasterTitle,
    attendanceSummary,
    classAttendanceTotalDays,
    releasedAt: releaseRes.rows[0]?.released_at || null,
  };
}

export async function resolveArchiveSignatures(
  tenantId: number,
  classId: number,
  overrides?: ArchiveSignatures
): Promise<ArchiveSignatures> {
  const classTeacherRes = await query(
    `SELECT t.signature, t.full_name
     FROM class_teachers ct
     JOIN teachers t ON t.id = ct.teacher_id AND t.tenant_id = ct.tenant_id
     WHERE ct.tenant_id = $2 AND ct.class_id = $1 AND ct.is_main = true
       AND t.signature IS NOT NULL AND TRIM(t.signature) <> ''
     LIMIT 1`,
    [classId, tenantId]
  );

  let classTeacherRow = classTeacherRes.rows[0];
  if (!classTeacherRow) {
    const fallbackRes = await query(
      `SELECT t.signature, t.full_name
       FROM classes c
       JOIN teachers t ON t.id = c.assigned_teacher_id AND t.tenant_id = c.tenant_id
       WHERE c.id = $1 AND c.tenant_id = $2
         AND t.signature IS NOT NULL AND TRIM(t.signature) <> ''
         AND NOT EXISTS (
           SELECT 1 FROM class_teachers ct
           WHERE ct.class_id = c.id AND ct.tenant_id = c.tenant_id AND ct.is_main = true
         )
       LIMIT 1`,
      [classId, tenantId]
    );
    classTeacherRow = fallbackRes.rows[0];
  }

  const headmasterRes = await query(
    `SELECT COALESCE(t.full_name, u.full_name) AS full_name,
            COALESCE(NULLIF(TRIM(t.headmaster_title), ''), 'Headmaster') AS headmaster_title,
            t.signature AS headmaster_signature
     FROM users u
     LEFT JOIN teachers t ON t.id::text = u.teacher_id::text AND t.tenant_id = u.tenant_id
     WHERE u.tenant_id = $1 AND u.role = 'headmaster' AND u.is_active = true
     ORDER BY u.id ASC
     LIMIT 1`,
    [tenantId]
  ).catch(() => ({ rows: [] as any[] }));

  const settingsRes = await query(
    `SELECT appointment_letter_config->>'signatureImage' AS signature_image
     FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );

  const classTeacherSig =
    overrides?.classTeacherSig ||
    classTeacherRow?.signature ||
    null;
  const headTeacherSig =
    overrides?.headTeacherSig ||
    headmasterRes.rows[0]?.headmaster_signature ||
    settingsRes.rows[0]?.signature_image ||
    null;

  return {
    classTeacherSig,
    headTeacherSig,
    headmasterTitle: overrides?.headmasterTitle || headmasterRes.rows[0]?.headmaster_title || 'Headmaster',
    headmasterName: overrides?.headmasterName || headmasterRes.rows[0]?.full_name || null,
  };
}

function resolveAttendanceDisplay(
  studentId: number,
  parsed: ReturnType<typeof parseTeacherRemarkBundle>,
  report: BuiltTermReport
) {
  const system = report.attendanceSummary[studentId];
  const classTotal = report.classAttendanceTotalDays ?? system?.totalDays ?? 0;
  const attendance =
    parsed.attendance !== ''
      ? parsed.attendance
      : (system?.present != null ? String(system.present) : '');
  const attendanceOutOf =
    parsed.attendanceOutOf !== ''
      ? parsed.attendanceOutOf
      : (classTotal > 0 ? String(classTotal) : '');
  return { attendance, attendanceOutOf, present: system?.present ?? null, totalDays: classTotal };
}

async function upsertStudentReportCardArchive(
  tenantId: number,
  report: BuiltTermReport,
  student: TermReportStudentRow,
  signatures: ArchiveSignatures,
  archivedBy: number
): Promise<'inserted' | 'updated'> {
  const teacherRemarkRaw = report.teacherRemarks[student.studentId] || '';
  const headmasterRemark = report.headmasterRemarks[student.studentId] || '';
  const parsedRemark = parseTeacherRemarkBundle(teacherRemarkRaw);
  const attendance = resolveAttendanceDisplay(student.studentId, parsedRemark, report);

  const gradesSnapshot = {
    subjectScores: student.subjectScores,
    grandTotal: student.grandTotal,
    grandMax: student.grandMax,
    percentage: student.percentage,
    position: student.position,
  };

  const remarksSnapshot = {
    teacher: teacherRemarkRaw,
    headmaster: headmasterRemark,
    parsed: parsedRemark,
  };

  const existingRes = await query(
    `SELECT signatures_snapshot FROM report_card_archive
     WHERE tenant_id = $1 AND student_id = $2 AND term = $3 AND academic_year = $4`,
    [tenantId, student.studentId, report.currentTerm, report.currentYear]
  );
  const existingSigs = (existingRes.rows[0]?.signatures_snapshot || {}) as ArchiveSignatures;
  const mergedSignatures: ArchiveSignatures = {
    headmasterTitle:
      signatures.headmasterTitle || existingSigs.headmasterTitle || 'Headmaster',
    headmasterName: signatures.headmasterName ?? existingSigs.headmasterName ?? null,
    classTeacherSig:
      signatures.classTeacherSig || existingSigs.classTeacherSig || null,
    headTeacherSig:
      signatures.headTeacherSig || existingSigs.headTeacherSig || null,
  };

  const snapshot = {
    version: 1,
    schoolName: report.schoolName,
    schoolLogoUrl: report.schoolLogoUrl,
    className: report.className,
    classId: report.classId,
    currentTerm: report.currentTerm,
    currentYear: report.currentYear,
    student,
    allStudents: report.students,
    subjects: report.subjects,
    assignments: report.assignments,
    gradeScale: report.gradeScale,
    teacherRemark: teacherRemarkRaw,
    headmasterRemark,
    parsedRemark,
    attendance,
    signatures: mergedSignatures,
    headmasterName: report.headmasterName,
    headmasterTitle: report.headmasterTitle,
    releasedAt: report.releasedAt || new Date().toISOString(),
  };

  const result = await query(
    `INSERT INTO report_card_archive (
       tenant_id, student_id, class_id, academic_year, term,
       class_name, student_admission_number, student_first_name, student_last_name,
       snapshot_json, grades_snapshot, remarks_snapshot, signatures_snapshot,
       position, percentage, grand_total, released_by, released_at, generated_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb,
       $14, $15, $16, $17, NOW(), NOW()
     )
     ON CONFLICT (tenant_id, student_id, term, academic_year) DO UPDATE SET
       class_id = EXCLUDED.class_id,
       class_name = EXCLUDED.class_name,
       student_admission_number = EXCLUDED.student_admission_number,
       student_first_name = EXCLUDED.student_first_name,
       student_last_name = EXCLUDED.student_last_name,
       snapshot_json = EXCLUDED.snapshot_json,
       grades_snapshot = EXCLUDED.grades_snapshot,
       remarks_snapshot = EXCLUDED.remarks_snapshot,
       signatures_snapshot = EXCLUDED.signatures_snapshot,
       position = EXCLUDED.position,
       percentage = EXCLUDED.percentage,
       grand_total = EXCLUDED.grand_total,
       generated_at = NOW()
     RETURNING id, (xmax = 0) AS inserted`,
    [
      tenantId,
      student.studentId,
      report.classId,
      report.currentYear,
      report.currentTerm,
      report.className,
      student.admissionNumber,
      student.firstName,
      student.lastName,
      JSON.stringify(snapshot),
      JSON.stringify(gradesSnapshot),
      JSON.stringify(remarksSnapshot),
      JSON.stringify(mergedSignatures),
      student.position,
      student.percentage,
      student.grandTotal,
      archivedBy,
    ]
  );

  return result.rows[0]?.inserted ? 'inserted' : 'updated';
}

/** Archive or update a single student's report card for the current term. */
export async function archiveStudentReportCard(
  tenantId: number,
  classId: number,
  studentId: number,
  archivedBy: number,
  signatureOverrides?: ArchiveSignatures
): Promise<'inserted' | 'updated' | 'skipped'> {
  const report = await buildTermReportData(tenantId, classId);
  if (!report) return 'skipped';

  const student = report.students.find((s) => s.studentId === studentId);
  if (!student) return 'skipped';

  const signatures = await resolveArchiveSignatures(tenantId, classId, signatureOverrides);
  return upsertStudentReportCardArchive(tenantId, report, student, signatures, archivedBy);
}

export async function archiveClassReportCardsOnRelease(
  tenantId: number,
  classId: number,
  releasedBy: number,
  signatureOverrides?: ArchiveSignatures
): Promise<{ archived: number; updated: number }> {
  const report = await buildTermReportData(tenantId, classId);
  if (!report) return { archived: 0, updated: 0 };

  const signatures = await resolveArchiveSignatures(tenantId, classId, signatureOverrides);
  let archived = 0;
  let updated = 0;

  for (const student of report.students) {
    const result = await upsertStudentReportCardArchive(tenantId, report, student, signatures, releasedBy);
    if (result === 'inserted') archived += 1;
    else updated += 1;
  }

  return { archived, updated };
}

export type ReportReleaseStudentGap = {
  studentId: number;
  name: string;
  missing: string[];
};

export type ReportReleaseValidation = {
  ok: boolean;
  errors: string[];
  students: ReportReleaseStudentGap[];
};

function listIncompleteRemarkFields(
  teacherRemarkRaw: string,
  headmasterRemark: string,
  studentId: number,
  report: BuiltTermReport
): string[] {
  const parsed = parseTeacherRemarkBundle(teacherRemarkRaw);
  const attendance = resolveAttendanceDisplay(studentId, parsed, report);
  const missing: string[] = [];

  if (!parsed.conduct) missing.push('Conduct');
  if (!parsed.attitude) missing.push('Attitude');
  if (!parsed.interest) missing.push('Interest');
  if (!attendance.attendance) missing.push('Attendance');
  if (!attendance.attendanceOutOf) missing.push('Attendance (out of)');
  if (!parsed.promotedTo) missing.push('Promoted To');
  if (!parsed.reopeningDate) missing.push('Reopening Date');
  if (!parsed.text) missing.push("Class Teacher's Remarks");
  if (!String(headmasterRemark || '').trim()) missing.push("Headmaster's Remarks");

  return missing;
}

/** Ensure every student remark field and both signatures exist before parent release. */
export async function validateClassReportReadyForRelease(
  tenantId: number,
  classId: number,
  signatureOverrides?: ArchiveSignatures
): Promise<ReportReleaseValidation> {
  const report = await buildTermReportData(tenantId, classId);
  const errors: string[] = [];
  const students: ReportReleaseStudentGap[] = [];

  if (!report) {
    return { ok: false, errors: ['No grades or assessments found for this class.'], students: [] };
  }

  const signatures = await resolveArchiveSignatures(tenantId, classId, signatureOverrides);
  if (!String(signatures.classTeacherSig || '').trim()) {
    errors.push('Class teacher signature is required before releasing to parents.');
  }
  if (!String(signatures.headTeacherSig || '').trim()) {
    errors.push('Headmaster signature is required before releasing to parents.');
  }

  for (const student of report.students) {
    const teacherRaw = report.teacherRemarks[student.studentId] || '';
    const headRaw = report.headmasterRemarks[student.studentId] || '';
    const missing = listIncompleteRemarkFields(teacherRaw, headRaw, student.studentId, report);
    if (missing.length > 0) {
      students.push({
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`.trim(),
        missing,
      });
    }
  }

  if (students.length > 0) {
    errors.push(
      `${students.length} student${students.length === 1 ? '' : 's'} still ha${students.length === 1 ? 's' : 've'} incomplete report details.`
    );
  }

  return { ok: errors.length === 0, errors, students };
}

export async function getStudentReportCardArchiveList(tenantId: number, studentId: number) {
  const result = await query(
    `SELECT
       a.id,
       a.student_id,
       a.class_id,
       a.academic_year,
       a.term,
       a.class_name,
       a.student_admission_number,
       a.student_first_name,
       a.student_last_name,
       a.position,
       a.percentage,
       a.grand_total,
       a.released_at,
       a.generated_at,
       u.full_name AS released_by_name
     FROM report_card_archive a
     LEFT JOIN users u ON a.released_by = u.id
     WHERE a.tenant_id = $1 AND a.student_id = $2
     ORDER BY a.academic_year DESC, a.released_at DESC, a.term DESC`,
    [tenantId, studentId]
  );
  return result.rows;
}

export async function getReportCardArchiveById(tenantId: number, archiveId: number) {
  const result = await query(
    `SELECT a.*, u.full_name AS released_by_name
     FROM report_card_archive a
     LEFT JOIN users u ON a.released_by = u.id
     WHERE a.tenant_id = $1 AND a.id = $2`,
    [tenantId, archiveId]
  );
  return result.rows[0] || null;
}

export async function getArchivedReportForStudentTerm(
  tenantId: number,
  studentId: number,
  term: string,
  academicYear: string
) {
  const termKey = String(term || '').trim();
  const yearKey = String(academicYear || '').trim();

  let result = await query(
    `SELECT * FROM report_card_archive
     WHERE tenant_id = $1 AND student_id = $2
       AND TRIM(term) = $3 AND TRIM(academic_year) = $4`,
    [tenantId, studentId, termKey, yearKey]
  );
  if (result.rows[0]) return result.rows[0];

  result = await query(
    `SELECT * FROM report_card_archive
     WHERE tenant_id = $1 AND student_id = $2 AND TRIM(term) = $3
     ORDER BY released_at DESC NULLS LAST, generated_at DESC NULLS LAST
     LIMIT 1`,
    [tenantId, studentId, termKey]
  );
  return result.rows[0] || null;
}

export async function getStudentAcademicTranscript(tenantId: number, studentId: number) {
  const archives = await query(
    `SELECT id, academic_year, term, class_name, position, percentage, grand_total,
            grades_snapshot, remarks_snapshot, released_at
     FROM report_card_archive
     WHERE tenant_id = $1 AND student_id = $2
     ORDER BY academic_year ASC, released_at ASC, term ASC`,
    [tenantId, studentId]
  );

  const studentRes = await query(
    `SELECT s.first_name, s.last_name, s.student_id AS admission_number, c.class_name AS current_class
     FROM students s
     LEFT JOIN classes c ON s.class_assigned_id = c.id
     WHERE s.id = $1 AND s.tenant_id = $2`,
    [studentId, tenantId]
  );
  const student = studentRes.rows[0];

  const terms = archives.rows.map((row: any) => {
    const grades = row.grades_snapshot || {};
    const subjectScores = grades.subjectScores || {};
    const subjects = Object.entries(subjectScores).map(([name, data]: [string, any]) => ({
      subject: name,
      score: data?.score ?? null,
      classScore: data?.classScore ?? null,
      examScore: data?.examScore ?? null,
    }));

    return {
      archiveId: row.id,
      academicYear: row.academic_year,
      term: row.term,
      className: row.class_name,
      position: row.position,
      percentage: row.percentage != null ? Number(row.percentage) : null,
      grandTotal: row.grand_total != null ? Number(row.grand_total) : null,
      subjects,
      releasedAt: row.released_at,
    };
  });

  const allSubjects = new Set<string>();
  for (const t of terms) {
    for (const s of t.subjects) allSubjects.add(s.subject);
  }

  return {
    student: student
      ? {
          firstName: student.first_name,
          lastName: student.last_name,
          admissionNumber: student.admission_number,
          currentClass: student.current_class,
        }
      : null,
    subjectColumns: Array.from(allSubjects).sort(),
    terms,
  };
}

function parseArchiveSnapshot(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, any>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, any>;
}

export function buildParentReportFromArchive(archiveRow: any, studentId: number) {
  const snapshot = parseArchiveSnapshot(archiveRow.snapshot_json);
  const snapshotStudent = snapshot.student;
  const rawStudents = Array.isArray(snapshot.allStudents)
    ? snapshot.allStudents
    : snapshotStudent
      ? [snapshotStudent]
      : [];

  const students = rawStudents
    .filter(Boolean)
    .map((s: any) => ({
      ...s,
      studentId: Number(s.studentId ?? s.id ?? studentId),
      isCurrentStudent: Number(s.studentId ?? s.id) === Number(studentId),
    }));

  if (!students.some((s) => s.isCurrentStudent) && snapshotStudent) {
    students.push({
      ...snapshotStudent,
      studentId: Number(snapshotStudent.studentId ?? snapshotStudent.id ?? studentId),
      isCurrentStudent: true,
    });
  }

  const signaturesRaw = archiveRow.signatures_snapshot;
  const signatures =
    snapshot.signatures ||
    (typeof signaturesRaw === 'string'
      ? parseArchiveSnapshot(signaturesRaw)
      : signaturesRaw) ||
    {};

  const teacherRemark = snapshot.teacherRemark || '';
  const headmasterRemark = snapshot.headmasterRemark || '';

  return {
    className: snapshot.className || archiveRow.class_name,
    classId: snapshot.classId || archiveRow.class_id,
    subjects: snapshot.subjects || [],
    assignments: snapshot.assignments || [],
    students,
    totalStudents: students.length,
    myStudentId: studentId,
    currentTerm: snapshot.currentTerm || archiveRow.term,
    currentYear: snapshot.currentYear || archiveRow.academic_year,
    schoolName: snapshot.schoolName || '',
    releasedAt: archiveRow.released_at,
    teacherRemark,
    headmasterRemark,
    archived: true,
    archiveId: archiveRow.id,
    signatures,
    parsedRemark: snapshot.parsedRemark,
    attendance: snapshot.attendance,
  };
}
