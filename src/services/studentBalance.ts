import { apiService } from './api';

export type BalanceLine = { termName: string; amount: number };

export type ArrearsBreakdownLine = {
  description: string;
  amount: number;
  entryType: string;
  date: string;
};

export type StudentBalance = {
  currentTermFee: number;
  currentTermName: string | null;
  activeTermId: number | null;
  arrearLines: BalanceLine[];
  totalArrears: number;
  creditBroughtForward?: number;
  totalDue: number;
  paidLines: BalanceLine[];
  totalPaid: number;
  outstanding: number;
  credit: number;
  netBalance?: number;
  status: 'Owing' | 'Cleared' | 'Credit' | 'NotSet';
  arrearsBreakdown?: ArrearsBreakdownLine[];
  totalCharged?: number;
  paymentsMade?: number;
  termRows?: Array<{
    termId: number | null;
    termName: string;
    termFee: number;
    amountPaid: number;
    outstanding: number;
    isActiveTerm: boolean;
  }>;
};

export type TermLedgerSummaryRow = {
  termId: number;
  termLabel: string;
  feeBilled: number;
  amountPaid: number;
  outstanding: number;
  credit: number;
  status: 'Paid' | 'Owing' | 'Credit' | 'NotSet';
};

export type LedgerStatementEntry = {
  id: number;
  date: string;
  description: string;
  entryType: string;
  debit: number;
  credit: number;
  runningBalance: number;
  receiptNumber: string | null;
  paymentMethod: string | null;
  paymentId: number | null;
};

export type LedgerTermOption = {
  termId: number;
  academicYearId: number;
  label: string;
};

export type StudentLedgerStatementResponse = {
  student: {
    id: number;
    fullName: string;
    studentId: string;
    admissionNumber: string;
    className: string;
  };
  termId: number | null;
  academicYearId: number | null;
  termLabel: string | null;
  availableTerms: LedgerTermOption[];
  entries: LedgerStatementEntry[];
  summary: {
    totalCharged: number;
    totalPaid: number;
    outstanding: number;
  };
  termSummary?: TermLedgerSummaryRow[];
};

export async function fetchStudentLedgerStatement(
  studentId: number | string,
  opts?: { termId?: number | null; academicYearId?: number | null; allTerms?: boolean; currentTermOnly?: boolean }
): Promise<StudentLedgerStatementResponse> {
  const params = new URLSearchParams();
  if (opts?.allTerms) params.set('all_terms', 'true');
  if (opts?.currentTermOnly) params.set('current_term', 'true');
  if (opts?.termId != null) params.set('term_id', String(opts.termId));
  if (opts?.academicYearId != null) params.set('academic_year_id', String(opts.academicYearId));
  const qs = params.toString();
  return apiService.get(
    `/students/${encodeURIComponent(String(studentId))}/ledger-statement${qs ? `?${qs}` : ''}`
  );
}

/** @deprecated Use fetchStudentLedgerStatement */
export type StudentLedgerStatement = StudentLedgerStatementResponse & {
  studentId: number;
  totalCharged: number;
  totalPaid: number;
  balance: number;
  outstanding: number;
  credit: number;
};

export async function fetchStudentStatement(
  studentId: number | string,
  opts?: { termId?: number; academicYearId?: number }
): Promise<{ statement: StudentLedgerStatement }> {
  const data = await fetchStudentLedgerStatement(studentId, opts);
  return {
    statement: {
      ...data,
      studentId: data.student.id,
      totalCharged: data.summary.totalCharged,
      totalPaid: data.summary.totalPaid,
      balance: data.summary.outstanding,
      outstanding: Math.max(0, data.summary.outstanding),
      credit: Math.max(0, -data.summary.outstanding),
    },
  };
}

export async function fetchStudentBalance(studentId: number | string): Promise<StudentBalance> {
  return apiService.get<StudentBalance>(
    `/fee-calculations/students/${encodeURIComponent(String(studentId))}/balance`
  );
}

export async function fetchClassStudentBalances(
  classId?: number | string | null
): Promise<{
  activeTermLabel: string | null;
  balances: Record<string, StudentBalance>;
  summary?: {
    studentsOwing: number;
    studentsCredit: number;
    studentsWithArrears: number;
    totalOutstanding: number;
    totalCredit: number;
    totalArrears: number;
    totalStudents: number;
  };
}> {
  const params = new URLSearchParams();
  if (classId != null && String(classId).trim() !== '') {
    params.set('classId', String(classId));
  }
  const qs = params.toString();
  return apiService.get(`/fee-calculations/students/balances${qs ? `?${qs}` : ''}`);
}

/** Format balance lines for display (records page / fee status). */
export function formatBalanceLines(b: StudentBalance) {
  const lines: Array<{
    label: string;
    amount: number;
    kind: 'charge' | 'total' | 'paid' | 'outstanding' | 'divider' | 'credit';
  }> = [];

  const termLabel = b.currentTermName ?? 'Current term';
  lines.push({ label: `Term Fee (${termLabel})`, amount: b.currentTermFee, kind: 'charge' });

  for (const row of b.arrearLines) {
    lines.push({ label: `Arrears — ${row.termName}`, amount: row.amount, kind: 'charge' });
  }

  if ((b.creditBroughtForward ?? 0) > 0) {
    lines.push({
      label: 'Credit Available',
      amount: b.creditBroughtForward ?? 0,
      kind: 'credit',
    });
  }

  lines.push({ label: 'Total Due', amount: b.totalDue, kind: 'total' });

  if ((b.totalPaid ?? 0) > 0) {
    lines.push({ label: 'Paid this term', amount: -(b.totalPaid ?? 0), kind: 'paid' });
  }

  for (const row of b.paidLines) {
    if ((b.totalPaid ?? 0) > 0) continue;
    lines.push({ label: `Paid — ${row.termName}`, amount: -row.amount, kind: 'paid' });
  }

  lines.push({ label: 'Outstanding', amount: b.outstanding, kind: 'outstanding' });

  return lines;
}
