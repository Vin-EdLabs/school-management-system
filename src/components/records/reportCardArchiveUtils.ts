import { buildReportCardPrintHtml, openReportCardPrintWindow } from '../reports/buildReportCardPrintHtml';
import { parseTeacherRemarkDetails, teacherRemarkTextForDisplay } from '../reports/termReportTypes';
import { resolveLogoUrl } from '../../services/tenantService';

export type ReportCardArchiveRow = {
  id: number;
  academic_year: string;
  term: string;
  class_name?: string;
  position?: number;
  percentage?: number;
  grand_total?: number;
  released_at?: string;
  released_by_name?: string;
  snapshot_json?: Record<string, unknown>;
  signatures_snapshot?: Record<string, unknown>;
};

export type AcademicTranscript = {
  student: {
    firstName: string;
    lastName: string;
    admissionNumber: string;
    currentClass?: string;
  } | null;
  subjectColumns: string[];
  terms: Array<{
    archiveId: number;
    academicYear: string;
    term: string;
    className: string;
    position: number | null;
    percentage: number | null;
    grandTotal: number | null;
    subjects: Array<{ subject: string; score: number | null }>;
    releasedAt: string;
  }>;
};

function normalizeSnapshot(archive: { snapshot_json?: unknown }) {
  const raw = archive.snapshot_json;
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw as Record<string, unknown>;
}

export function buildArchivedReportCardHtml(archive: {
  snapshot_json?: unknown;
  signatures_snapshot?: unknown;
}): string | null {
  const snapshot = normalizeSnapshot(archive);
  if (!snapshot?.student) return null;

  const student = snapshot.student as Parameters<typeof buildReportCardPrintHtml>[0]['student'];
  const allStudents = (snapshot.allStudents || [student]) as Parameters<
    typeof buildReportCardPrintHtml
  >[0]['termReportStudents'];
  const parsed = parseTeacherRemarkDetails(String(snapshot.teacherRemark || ''));
  const signatures = (snapshot.signatures || archive.signatures_snapshot || {}) as {
    classTeacherSig?: string;
    headTeacherSig?: string;
    headmasterTitle?: string;
  };
  const attendance = (snapshot.attendance || {}) as { attendance?: string; attendanceOutOf?: string };

  const logoUrl = snapshot.schoolLogoUrl
    ? resolveLogoUrl(String(snapshot.schoolLogoUrl)) || undefined
    : undefined;
  const photoUrl = student.passportPhotoUrl
    ? resolveLogoUrl(String(student.passportPhotoUrl)) || undefined
    : undefined;

  return buildReportCardPrintHtml({
    schoolName: String(snapshot.schoolName || ''),
    schoolLogoUrl: logoUrl,
    className: String(snapshot.className || ''),
    currentTerm: String(snapshot.currentTerm || ''),
    currentYear: String(snapshot.currentYear || ''),
    student,
    studentPhotoUrl: photoUrl,
    totalStudents: allStudents.length,
    subjects: (snapshot.subjects as string[]) || [],
    termReportStudents: allStudents,
    conduct: parsed.conduct,
    attitude: parsed.attitude,
    interest: parsed.interest,
    attendance: attendance.attendance || parsed.attendance,
    attendanceOutOf: attendance.attendanceOutOf || parsed.attendanceOutOf,
    promotedTo: parsed.promotedTo,
    reopeningDate: parsed.reopeningDate,
    teacherRemark: teacherRemarkTextForDisplay(String(snapshot.teacherRemark || '')),
    headmasterRemark: String(snapshot.headmasterRemark || ''),
    headmasterTitle: signatures.headmasterTitle || String(snapshot.headmasterTitle || 'Headmaster'),
    classTeacherSig: signatures.classTeacherSig || undefined,
    headTeacherSig: signatures.headTeacherSig || undefined,
  });
}

export function openArchivedReportCardPrint(archive: {
  snapshot_json?: unknown;
  signatures_snapshot?: unknown;
}): boolean {
  const html = buildArchivedReportCardHtml(archive);
  if (!html) return false;
  openReportCardPrintWindow(html);
  return true;
}

export function formatArchiveDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
