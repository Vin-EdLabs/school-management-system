import type { FeeStructure, Student } from '../../contexts/DataContext';

export function normalizeEnrollmentStatus(raw: string | undefined): string {
  const s = (raw || 'active').toLowerCase().trim();
  if (['active', 'inactive', 'pending', 'graduated', 'suspended', 'alumni'].includes(s)) {
    return s === 'alumni' ? 'graduated' : s;
  }
  return s || 'active';
}

export function shouldTrackStudentFees(student: { enrollmentStatus?: string }): boolean {
  const s = normalizeEnrollmentStatus(student.enrollmentStatus);
  return s !== 'pending';
}

export function isActiveEnrolledStudent(student: { enrollmentStatus?: string }): boolean {
  return normalizeEnrollmentStatus(student.enrollmentStatus) === 'active';
}

/** Term-fee billing only — daily fee classes use the separate Daily Fees module. */
export function isTermFeeClassStudent(
  student: { classAssignedId?: number | string | null; classAssigned?: string },
  classes: Array<{ id?: number | string; className?: string; feeMode?: 'term' | 'daily' }>
): boolean {
  const classId = student.classAssignedId;
  if (classId != null) {
    const cls = classes.find((c) => Number(c.id) === Number(classId));
    if (cls) return cls.feeMode !== 'daily';
  }
  const className = String(student.classAssigned || '').trim();
  if (className) {
    const cls = classes.find((c) => String(c.className || '').trim() === className);
    if (cls) return cls.feeMode !== 'daily';
  }
  return true;
}

export function isPendingStudent(student: { enrollmentStatus?: string }): boolean {
  return normalizeEnrollmentStatus(student.enrollmentStatus) === 'pending';
}

/** User-facing label — graduated students are shown as Alumni. */
export function enrollmentStatusLabel(raw: string | undefined): string {
  const s = normalizeEnrollmentStatus(raw);
  if (s === 'graduated') return 'Alumni';
  if (s === 'pending') return 'Pending';
  if (s === 'inactive') return 'Inactive';
  if (s === 'suspended') return 'Suspended';
  return 'Active';
}

export function isAlumniStudent(student: { enrollmentStatus?: string }): boolean {
  return normalizeEnrollmentStatus(student.enrollmentStatus) === 'graduated';
}

export function classBadgeClass(className: string): string {
  const c = (className || '').toUpperCase();
  if (c.includes('JHS') || c.includes('J.H.S')) {
    return 'border-amber-400/40 bg-amber-500/10 text-amber-800 dark:text-amber-200';
  }
  if (c.includes('PRIMARY') || c.includes('PRY')) {
    return 'border-sky-400/40 bg-sky-500/10 text-sky-900 dark:text-sky-100';
  }
  if (c.includes('KG') || c.includes('NURSERY') || c.includes('CRECHE')) {
    return 'border-violet-400/40 bg-violet-500/10 text-violet-900 dark:text-violet-100';
  }
  if (c.includes('SHS') || c.includes('S.H.S')) {
    return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100';
  }
  return 'border-border bg-muted/60 text-foreground';
}

export function statusBadgeClass(status: string): string {
  const s = normalizeEnrollmentStatus(status);
  if (s === 'active') return 'border-emerald-500/30 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200';
  if (s === 'pending') return 'border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-200';
  if (s === 'inactive') return 'border-slate-400/40 bg-slate-500/10 text-slate-600 dark:text-slate-400';
  if (s === 'graduated') return 'border-indigo-500/35 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200';
  if (s === 'suspended') return 'border-red-500/35 bg-red-500/10 text-red-800 dark:text-red-200';
  return 'border-border bg-muted/70 text-foreground';
}

export function totalScheduledFeesForStudent(
  student: Student,
  feeStructures: FeeStructure[],
  currentTerm: string | undefined
): number {
  const fs = feeStructures || [];
  const classMatch = (f: FeeStructure & { class_name?: string }) =>
    (f.classId != null &&
      student.classAssignedId != null &&
      Number(f.classId) === Number(student.classAssignedId)) ||
    f.className === student.classAssigned ||
    f.class_name === student.classAssigned;
  const termMatch = (f: FeeStructure) =>
    !!currentTerm &&
    currentTerm !== 'Not Set' &&
    !!f.term &&
    (f.term === currentTerm || f.term.includes(currentTerm) || currentTerm.includes(f.term));
  return fs.filter((f) => classMatch(f as FeeStructure & { class_name?: string }) && termMatch(f)).reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
}

export function paymentsForStudentTerm(
  studentId: string,
  payments: { studentId?: string; amount: number; amount_paid?: number; term?: string; isVoided?: boolean }[],
  currentTerm: string | undefined
): { studentId?: string; amount: number; amount_paid?: number; term?: string; isVoided?: boolean }[] {
  return (payments || []).filter((p) => {
    if (p.isVoided) return false;
    if (String(p.studentId) !== String(studentId)) return false;
    if (!currentTerm || currentTerm === 'Not Set') return true;
    const t = p.term || '';
    return t === currentTerm || t.includes(currentTerm) || currentTerm.includes(t);
  });
}

export function guardianContactLinks(contact: string | undefined | null) {
  const raw = String(contact || '').trim();
  const digits = raw.replace(/\D/g, '');
  return {
    display: raw || '—',
    tel: digits ? `tel:${digits}` : null,
    whatsapp: digits ? `https://wa.me/${digits}` : null,
  };
}

export function exportStudentsToCsv(rows: Student[]): string {
  const headers = [
    'Student ID',
    'Admission',
    'First name',
    'Last name',
    'Class',
    'Gender',
    'Status',
    'Guardian',
    'Guardian phone',
  ];
  const esc = (v: string | number | undefined | null) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(','),
    ...rows.map((s) =>
      [
        esc(s.studentId),
        esc(s.admissionNumber),
        esc(s.firstName),
        esc(s.lastName),
        esc(s.classAssigned),
        esc(s.gender),
        esc(enrollmentStatusLabel(s.enrollmentStatus)),
        esc(s.guardianName),
        esc(s.guardianContact),
      ].join(',')
    ),
  ];
  return lines.join('\n');
}
