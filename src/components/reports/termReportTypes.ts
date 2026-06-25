export interface TermReportStudent {
  studentId: number;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  hasMoved: boolean;
  subjectScores: Record<string, {
    score: number;
    maxScore: number;
    classScore?: number | null;
    examScore?: number | null;
    total?: number;
    percentage?: number;
    grade?: string | number;
    remark?: string;
  }>;
  grandTotal: number;
  grandMax: number;
  percentage: number;
  position: number;
}

export interface TermReport {
  students: TermReportStudent[];
  subjects: string[];
  assignments: unknown[];
  assignmentsBySubject: Record<string, unknown[]>;
  className: string;
  currentTerm?: string;
  currentYear?: string;
  schoolName?: string;
  headmasterName?: string | null;
  headmasterTitle?: string | null;
  isReleased?: boolean;
  releasedAt?: string | null;
  releasedByName?: string | null;
  gradeScale?: Array<{ letter: string; minPct: number; maxPct: number; description?: string }>;
  teacherRemarks?: Record<number, string>;
  headmasterRemarks?: Record<number, string>;
  attendanceSummary?: Record<number, { present: number; totalDays: number }>;
  classAttendanceTotalDays?: number;
}

export type ParsedTeacherRemark = {
  text: string;
  conduct: string;
  attitude: string;
  interest: string;
  attendance: string;
  attendanceOutOf: string;
  promotedTo: string;
  reopeningDate: string;
};

export function parseTeacherRemarkDetails(rawRemark: string): ParsedTeacherRemark {
  try {
    if (rawRemark && rawRemark.trim().startsWith('{')) {
      const parsed = JSON.parse(rawRemark);
      return {
        text: parsed.text ?? '',
        conduct: parsed.conduct ?? 'Humble',
        attitude: parsed.attitude ?? 'Dependable',
        interest: parsed.interest ?? 'Sports',
        attendance: parsed.attendance ?? '',
        attendanceOutOf: parsed.attendanceOutOf ?? '',
        promotedTo: parsed.promotedTo ?? '',
        reopeningDate: parsed.reopeningDate ?? '21st April, 2026',
      };
    }
  } catch {
    // fallback
  }
  return {
    text: rawRemark ?? '',
    conduct: 'Humble',
    attitude: 'Dependable',
    interest: 'Sports',
    attendance: '',
    attendanceOutOf: '',
    promotedTo: '',
    reopeningDate: '21st April, 2026',
  };
}

export function normalizeTeacherRemarks(
  remarks?: Record<number | string, string> | null
): Record<number, string> {
  const out: Record<number, string> = {};
  if (!remarks) return out;
  for (const [key, value] of Object.entries(remarks)) {
    const id = Number(key);
    if (!Number.isNaN(id)) out[id] = value;
  }
  return out;
}

export function derivePromotedToState(
  teacherRemarks: Record<number | string, string>,
  studentIds: number[]
): { classPromotedTo: string; promotedOverrides: Record<number, string> } {
  const normalized = normalizeTeacherRemarks(teacherRemarks);
  const byStudent: Record<number, string> = {};
  for (const id of studentIds) {
    byStudent[id] = parseTeacherRemarkDetails(normalized[id] || '').promotedTo.trim();
  }

  const counts = new Map<string, number>();
  for (const v of Object.values(byStudent)) {
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }

  let classPromotedTo = '';
  let maxCount = 0;
  for (const [val, cnt] of counts) {
    if (cnt > maxCount) {
      maxCount = cnt;
      classPromotedTo = val;
    }
  }

  const promotedOverrides: Record<number, string> = {};
  for (const id of studentIds) {
    const v = byStudent[id];
    if (v && v !== classPromotedTo) promotedOverrides[id] = v;
  }

  return { classPromotedTo, promotedOverrides };
}

export function resolveAttendanceForStudent(
  studentId: number,
  parsed: ParsedTeacherRemark,
  report: Pick<TermReport, 'attendanceSummary' | 'classAttendanceTotalDays'>
): { attendance: string; attendanceOutOf: string } {
  const system = report.attendanceSummary?.[studentId];
  const classTotal = report.classAttendanceTotalDays ?? system?.totalDays ?? 0;
  const hasSavedAttendance = parsed.attendance !== '' || parsed.attendanceOutOf !== '';

  const attendance = parsed.attendance !== ''
    ? parsed.attendance
    : (system?.present != null ? String(system.present) : '');

  const attendanceOutOf = parsed.attendanceOutOf !== ''
    ? parsed.attendanceOutOf
    : (classTotal > 0 ? String(classTotal) : '');

  if (!hasSavedAttendance && !attendance && system?.present == null) {
    return { attendance: '', attendanceOutOf: classTotal > 0 ? String(classTotal) : '' };
  }

  return { attendance, attendanceOutOf };
}
