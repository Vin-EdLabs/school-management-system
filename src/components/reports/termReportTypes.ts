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
    gradeLabel?: string;
    remark?: string;
    subjectPosition?: number;
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
  classScoreWeight?: number;
  examWeight?: number;
  gradeBoundaries?: Array<{ gradeLabel: string; minPercent: number; maxPercent: number; remark: string }>;
  isReleased?: boolean;
  releasedAt?: string | null;
  releasedByName?: string | null;
  gradeScale?: Array<{ letter: string; minPct: number; maxPct: number; description?: string }>;
  teacherRemarks?: Record<number, string>;
  headmasterRemarks?: Record<number, string>;
  attendanceSummary?: Record<number, { present: number; totalDays: number }>;
  classAttendanceTotalDays?: number;
  isMainClassTeacherForUser?: boolean;
  reportSignatures?: {
    classTeacherSig?: string | null;
    headTeacherSig?: string | null;
    headmasterTitle?: string | null;
    headmasterName?: string | null;
  };
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

/** Legacy auto-fill values — treat as empty when loading or displaying. */
const LEGACY_REMARK_PLACEHOLDERS: Record<keyof Omit<ParsedTeacherRemark, 'text'>, Set<string>> = {
  conduct: new Set(['Humble']),
  attitude: new Set(['Dependable']),
  interest: new Set(['Sports']),
  attendance: new Set(),
  attendanceOutOf: new Set(),
  promotedTo: new Set(),
  reopeningDate: new Set(['21st April, 2026']),
};

function cleanRemarkField(
  field: keyof Omit<ParsedTeacherRemark, 'text'>,
  value: unknown
): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (LEGACY_REMARK_PLACEHOLDERS[field].has(s)) return '';
  return s;
}

export function parseTeacherRemarkDetails(rawRemark: string): ParsedTeacherRemark {
  try {
    if (rawRemark && rawRemark.trim().startsWith('{')) {
      const parsed = JSON.parse(rawRemark);
      return {
        text: String(parsed.text ?? '').trim(),
        conduct: cleanRemarkField('conduct', parsed.conduct),
        attitude: cleanRemarkField('attitude', parsed.attitude),
        interest: cleanRemarkField('interest', parsed.interest),
        attendance: cleanRemarkField('attendance', parsed.attendance),
        attendanceOutOf: cleanRemarkField('attendanceOutOf', parsed.attendanceOutOf),
        promotedTo: cleanRemarkField('promotedTo', parsed.promotedTo),
        reopeningDate: cleanRemarkField('reopeningDate', parsed.reopeningDate),
      };
    }
  } catch {
    // fallback
  }
  return {
    text: String(rawRemark ?? '').trim(),
    conduct: '',
    attitude: '',
    interest: '',
    attendance: '',
    attendanceOutOf: '',
    promotedTo: '',
    reopeningDate: '',
  };
}

/** Class teacher remarks line only — never the raw JSON blob. */
export function teacherRemarkTextForDisplay(rawRemark: string): string {
  const parsed = parseTeacherRemarkDetails(rawRemark);
  return parsed.text;
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

export function deriveReopeningDateState(
  teacherRemarks: Record<number | string, string>,
  studentIds: number[]
): { classReopeningDate: string } {
  const normalized = normalizeTeacherRemarks(teacherRemarks);
  const counts = new Map<string, number>();
  for (const id of studentIds) {
    const d = parseTeacherRemarkDetails(normalized[id] || '').reopeningDate.trim();
    if (d) counts.set(d, (counts.get(d) || 0) + 1);
  }
  let classReopeningDate = '';
  let maxCount = 0;
  for (const [val, cnt] of counts) {
    if (cnt > maxCount) {
      maxCount = cnt;
      classReopeningDate = val;
    }
  }
  return { classReopeningDate };
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

const REPORT_FIELD_LABELS = {
  conduct: 'Conduct',
  attitude: 'Attitude',
  interest: 'Interest',
  attendance: 'Attendance',
  attendanceOutOf: 'Attendance (out of)',
  promotedTo: 'Promoted To',
  reopeningDate: 'Reopening Date',
  text: "Class Teacher's Remarks",
  headmaster: "Headmaster's Remarks",
} as const;

/** Returns human-readable labels for fields still empty on a student's report card. */
export function listIncompleteReportFieldsForStudent(
  teacherRemarkRaw: string,
  headmasterRemark: string,
  studentId: number,
  report: Pick<TermReport, 'attendanceSummary' | 'classAttendanceTotalDays'>
): string[] {
  const parsed = parseTeacherRemarkDetails(teacherRemarkRaw);
  const attendance = resolveAttendanceForStudent(studentId, parsed, report);
  const missing: string[] = [];

  if (!parsed.conduct) missing.push(REPORT_FIELD_LABELS.conduct);
  if (!parsed.attitude) missing.push(REPORT_FIELD_LABELS.attitude);
  if (!parsed.interest) missing.push(REPORT_FIELD_LABELS.interest);
  if (!attendance.attendance) missing.push(REPORT_FIELD_LABELS.attendance);
  if (!attendance.attendanceOutOf) missing.push(REPORT_FIELD_LABELS.attendanceOutOf);
  if (!parsed.promotedTo) missing.push(REPORT_FIELD_LABELS.promotedTo);
  if (!parsed.reopeningDate) missing.push(REPORT_FIELD_LABELS.reopeningDate);
  if (!parsed.text) missing.push(REPORT_FIELD_LABELS.text);
  if (!String(headmasterRemark || '').trim()) missing.push(REPORT_FIELD_LABELS.headmaster);

  return missing;
}
