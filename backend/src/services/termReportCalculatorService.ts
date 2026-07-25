import { query } from '../db/connection.js';
import {
  calculateGrade,
  calculatePositions,
  type AssessmentScore,
  type GradeConfig,
} from '../utils/gradeCalculator.js';
import {
  loadGradeConfigAsCalculator,
  loadGradeConfigSnapshot,
  loadGradeConfigForTenant,
} from './gradeConfigService.js';
import { getSchoolActiveTermYear, assignmentTermWhereClause } from './gradesTermContext.js';
import { ACTIVE_STUDENT_WHERE } from '../utils/studentEnrollment.js';

export type SubjectResult = {
  subjectId: number | null;
  subjectName: string;
  classScorePercent: number;
  examPercent: number;
  totalPercent: number;
  gradeLabel: string;
  remark: string;
  subjectPosition: number;
  /** Legacy fields for records / archive UI */
  score: number;
  maxScore: number;
  classScore: number;
  examScore: number;
};

export type TermReportStudent = {
  studentId: number;
  studentName: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  passportPhotoUrl: string | null;
  hasMoved: boolean;
  subjectResults: SubjectResult[];
  totalMarksAcrossSubjects: number;
  overallPosition: number;
  /** Legacy */
  subjectScores: Record<
    string,
    { score: number; maxScore: number; classScore: number; examScore: number; gradeLabel?: string; remark?: string }
  >;
  grandTotal: number;
  grandMax: number;
  percentage: number;
  position: number;
};

export type BuiltConfigurableTermReport = {
  classScoreWeight: number;
  examWeight: number;
  boundaries: Array<{ gradeLabel: string; minPercent: number; maxPercent: number; remark: string }>;
  subjects: Array<{ subjectId: number | null; subjectName: string }>;
  students: TermReportStudent[];
  className: string;
  classId: number;
  currentTerm: string;
  currentYear: string;
  /** Legacy shape for reportCardArchiveService */
  assignments: unknown[];
  assignmentsBySubject: Record<string, unknown[]>;
};

async function resolveGradeConfig(
  tenantId: number,
  termOverride?: string,
  yearOverride?: string
): Promise<GradeConfig> {
  if (termOverride && yearOverride) {
    const snapRes = await query(
      `SELECT grade_config_snapshot FROM academic_terms
       WHERE tenant_id = $1 AND term_name = $2 AND year = $3
       LIMIT 1`,
      [tenantId, termOverride, yearOverride]
    );
    const fromSnap = await loadGradeConfigSnapshot(snapRes.rows[0]?.grade_config_snapshot);
    if (fromSnap) return fromSnap;
  }
  return loadGradeConfigAsCalculator(tenantId);
}

export async function buildConfigurableTermReport(
  tenantId: number,
  classId: number,
  termOverride?: string,
  yearOverride?: string,
  options?: { subjectFilter?: Set<string>; subjectIdFilter?: Set<number> }
): Promise<BuiltConfigurableTermReport | null> {
  const active =
    termOverride && yearOverride
      ? {
          term: termOverride,
          academicYear: yearOverride,
          fullTermLabel: `${termOverride} ${yearOverride}`.trim(),
        }
      : await getSchoolActiveTermYear(tenantId);

  const config = await resolveGradeConfig(tenantId, active.term, active.academicYear);
  const loaded = await loadGradeConfigForTenant(tenantId);

  const assignmentsRes = await query(
    `SELECT ga.id, ga.subject, ga.subject_id, ga.name, ga.assignment_type, ga.max_score, ga.max_marks,
            ga.is_exam, ga.component_id, gcc.name AS component_name
     FROM grade_assignments ga
     LEFT JOIN grade_config_components gcc ON gcc.id = ga.component_id
     WHERE ga.tenant_id = $1 AND ga.class_id = $2 ${assignmentTermWhereClause('ga', '$3', '$4', '$5')}
     ORDER BY ga.subject, ga.is_exam, gcc.display_order NULLS LAST, ga.name`,
    [tenantId, classId, active.term, active.academicYear, active.fullTermLabel]
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
     FROM students s
     WHERE s.tenant_id = $1 AND s.class_assigned_id = $2 AND ${ACTIVE_STUDENT_WHERE}
     ORDER BY first_name, last_name`,
    [tenantId, classId]
  );

  const assignmentIds = assignments.map((a) => a.id);
  const gradedStudentsRes = await query(
    `SELECT DISTINCT s.id, s.first_name, s.last_name, s.student_id AS admission_number, s.passport_photo_url
     FROM student_grades sg
     JOIN students s ON sg.student_id = s.id AND s.tenant_id = sg.tenant_id
     WHERE sg.tenant_id = $1 AND sg.assignment_id = ANY($2) AND ${ACTIVE_STUDENT_WHERE}`,
    [tenantId, assignmentIds]
  );

  const studentMap = new Map<number, any>();
  for (const s of studentsRes.rows) studentMap.set(s.id, { ...s, hasMoved: false });
  for (const s of gradedStudentsRes.rows) {
    if (!studentMap.has(s.id)) studentMap.set(s.id, { ...s, hasMoved: true });
  }
  const allStudents = Array.from(studentMap.values());

  const gradesRes = await query(
    `SELECT student_id, assignment_id, COALESCE(raw_score, score)::float AS raw_score
     FROM student_grades
     WHERE tenant_id = $1 AND assignment_id = ANY($2)`,
    [tenantId, assignmentIds]
  );

  const gradeMap: Record<number, Record<number, number>> = {};
  for (const g of gradesRes.rows) {
    if (!gradeMap[g.student_id]) gradeMap[g.student_id] = {};
    gradeMap[g.student_id][g.assignment_id] = g.raw_score;
  }

  const subjectOrder: string[] = [];
  const subjectIdByName = new Map<string, number | null>();
  for (const a of assignments) {
    if (!subjectOrder.includes(a.subject)) {
      subjectOrder.push(a.subject);
      subjectIdByName.set(a.subject, a.subject_id != null ? Number(a.subject_id) : null);
    }
  }

  let filteredSubjects = subjectOrder;
  if (options?.subjectFilter?.size) {
    filteredSubjects = subjectOrder.filter((s) => options.subjectFilter!.has(s));
  }
  if (options?.subjectIdFilter?.size) {
    filteredSubjects = subjectOrder.filter((s) => {
      const sid = subjectIdByName.get(s);
      return sid != null && options.subjectIdFilter!.has(sid);
    });
  }

  const assignmentsBySubject: Record<string, any[]> = {};
  for (const subj of filteredSubjects) {
    assignmentsBySubject[subj] = assignments.filter((a: any) => a.subject === subj);
  }

  const students: TermReportStudent[] = allStudents.map((s: any) => {
    const subjectResults: SubjectResult[] = [];

    for (const subj of filteredSubjects) {
      const subjectAssignments = assignmentsBySubject[subj];
      const assessmentScores: AssessmentScore[] = subjectAssignments.map((a: any) => ({
        assessmentId: Number(a.id),
        componentId: a.is_exam ? null : a.component_id != null ? Number(a.component_id) : null,
        isExam: !!a.is_exam,
        maxMarks: Number(a.max_marks ?? a.max_score) || 100,
        rawScore: gradeMap[s.id]?.[a.id] ?? 0,
      }));

      const result = calculateGrade(assessmentScores, config);
      subjectResults.push({
        subjectId: subjectIdByName.get(subj) ?? null,
        subjectName: subj,
        classScorePercent: result.classScorePercent,
        examPercent: result.examPercent,
        totalPercent: result.totalPercent,
        gradeLabel: result.gradeLabel,
        remark: result.remark,
        subjectPosition: 0,
        score: result.totalPercent,
        maxScore: 100,
        classScore: result.classScorePercent,
        examScore: result.examPercent,
      });
    }

    const totalMarksAcrossSubjects = subjectResults.reduce((sum, r) => sum + r.totalPercent, 0);
    const subjectScores: TermReportStudent['subjectScores'] = {};
    for (const sr of subjectResults) {
      subjectScores[sr.subjectName] = {
        score: sr.totalPercent,
        maxScore: 100,
        classScore: sr.classScorePercent,
        examScore: sr.examPercent,
        gradeLabel: sr.gradeLabel,
        remark: sr.remark,
      };
    }

    const grandMax = filteredSubjects.length * 100;
    return {
      studentId: s.id,
      studentName: `${s.first_name} ${s.last_name}`.trim(),
      firstName: s.first_name,
      lastName: s.last_name,
      admissionNumber: s.admission_number,
      passportPhotoUrl: s.passport_photo_url || null,
      hasMoved: s.hasMoved,
      subjectResults,
      totalMarksAcrossSubjects: Math.round(totalMarksAcrossSubjects * 10) / 10,
      overallPosition: 0,
      subjectScores,
      grandTotal: Math.round(totalMarksAcrossSubjects * 10) / 10,
      grandMax,
      percentage: grandMax > 0 ? Math.round((totalMarksAcrossSubjects / grandMax) * 1000) / 10 : 0,
      position: 0,
    };
  });

  for (const subj of filteredSubjects) {
    const perSubject = students.map((st) => {
      const sr = st.subjectResults.find((r) => r.subjectName === subj);
      return { studentId: st.studentId, totalPercent: sr?.totalPercent ?? 0 };
    });
    const positions = calculatePositions(perSubject);
    for (const st of students) {
      const sr = st.subjectResults.find((r) => r.subjectName === subj);
      if (sr) sr.subjectPosition = positions.get(st.studentId) ?? 0;
    }
  }

  const overallPositions = calculatePositions(
    students.map((st) => ({ studentId: st.studentId, totalPercent: st.totalMarksAcrossSubjects }))
  );
  for (const st of students) {
    st.overallPosition = overallPositions.get(st.studentId) ?? 0;
    st.position = st.overallPosition;
  }

  students.sort((a, b) => b.totalMarksAcrossSubjects - a.totalMarksAcrossSubjects);

  return {
    classScoreWeight: loaded.gradeConfig.classScoreWeight,
    examWeight: loaded.gradeConfig.examWeight,
    boundaries: loaded.boundaries.map((b) => ({
      gradeLabel: b.gradeLabel,
      minPercent: b.minPercent,
      maxPercent: b.maxPercent,
      remark: b.remark ?? '',
    })),
    subjects: filteredSubjects.map((name) => ({
      subjectId: subjectIdByName.get(name) ?? null,
      subjectName: name,
    })),
    students,
    className,
    classId,
    currentTerm: active.term,
    currentYear: active.academicYear,
    assignments,
    assignmentsBySubject,
  };
}
