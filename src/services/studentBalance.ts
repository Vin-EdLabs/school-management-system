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
  individualCharges?: number;
  individualChargeLines?: Array<{
    id: number;
    description: string;
    amount: number;
    date: string;
    status: 'unpaid' | 'paid';
    createdByName: string | null;
    reason: string | null;
  }>;
  totalDue: number;
  paidLines: BalanceLine[];
  totalPaid: number;
  outstanding: number;
  credit: number;
  netBalance?: number;
  status: 'Owing' | 'Cleared' | 'Credit' | 'NotSet';
  discountAmount?: number;
  discountLabel?: string;
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

export type OutstandingFeeStudent = {
  id: number;
  firstName: string;
  lastName: string;
  studentId: string;
  admissionNumber: string;
  classAssignedId: number | null;
  className: string;
  enrollmentStatus: string;
  termFee: number;
  individualCharges: number;
  arrears: number;
  totalPaid: number;
  outstanding: number;
};

export async function fetchOutstandingFees(
  classId?: number | string | null,
  ledgerTermId?: number | null
): Promise<{
  activeTermLabel: string | null;
  students: OutstandingFeeStudent[];
  summary: { studentsOwing: number; totalOutstanding: number; totalArrears: number };
}> {
  const params = new URLSearchParams();
  if (classId != null && String(classId).trim() !== '' && classId !== 'All') {
    params.set('classId', String(classId));
  }
  if (ledgerTermId != null && !Number.isNaN(Number(ledgerTermId))) {
    params.set('termId', String(ledgerTermId));
  }
  const qs = params.toString();
  return apiService.get(`/fee-calculations/students/outstanding-fees${qs ? `?${qs}` : ''}`);
}

/** Format balance lines for display (records page / fee status). */
export function formatBalanceLines(b: StudentBalance) {
  const lines: Array<{
    label: string;
    amount: number;
    kind: 'charge' | 'total' | 'paid' | 'outstanding' | 'divider' | 'credit';
  }> = [];

  const termLabel = b.currentTermName ?? 'Current term';
  const totalTermBillAmount = Number(b.currentTermFee || 0) + Number(b.individualCharges || 0);
  lines.push({ label: `Total Term Bill (${termLabel})`, amount: totalTermBillAmount, kind: 'charge' });

  for (const row of b.arrearLines) {
    lines.push({ label: `Arrears — ${row.termName}`, amount: row.amount, kind: 'charge' });
  }

  for (const charge of b.individualChargeLines ?? []) {
    const datePart = charge.date
      ? new Date(charge.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';
    lines.push({
      label: datePart
        ? `${charge.description} · Individual Charge · ${datePart}`
        : `${charge.description} · Individual Charge`,
      amount: charge.amount,
      kind: 'charge',
    });
  }

  if ((b.individualCharges ?? 0) > 0 && !(b.individualChargeLines?.length)) {
    lines.push({
      label: 'Individual charges',
      amount: b.individualCharges ?? 0,
      kind: 'charge',
    });
  }

  const creditBalance =
    (b.credit ?? 0) > 0
      ? b.credit
      : (b.netBalance ?? 0) < -0.001
        ? Math.abs(b.netBalance ?? 0)
        : 0;

  if (creditBalance > 0) {
    lines.push({
      label: 'Credit Balance',
      amount: creditBalance,
      kind: 'credit',
    });
  } else if ((b.creditBroughtForward ?? 0) > 0) {
    lines.push({
      label: 'Credit Available',
      amount: b.creditBroughtForward ?? 0,
      kind: 'credit',
    });
  }

  lines.push({
    label: (b.individualChargeLines?.length ?? 0) > 0 ? 'Total Billed' : 'Total Due',
    amount: b.totalDue,
    kind: 'total',
  });

  if ((b.totalPaid ?? 0) > 0) {
    lines.push({ label: 'Paid this term', amount: -(b.totalPaid ?? 0), kind: 'paid' });
  }

  for (const row of b.paidLines) {
    if ((b.totalPaid ?? 0) > 0) continue;
    lines.push({ label: `Paid — ${row.termName}`, amount: -row.amount, kind: 'paid' });
  }

  lines.push({ label: 'Outstanding Balance', amount: b.outstanding, kind: 'outstanding' });

  return lines;
}
