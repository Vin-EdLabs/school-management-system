import { apiService } from './api';

export type BalanceLine = { termName: string; amount: number };

export type StudentBalance = {
  currentTermFee: number;
  currentTermName: string | null;
  activeTermId: number | null;
  arrearLines: BalanceLine[];
  totalArrears: number;
  totalDue: number;
  paidLines: BalanceLine[];
  totalPaid: number;
  outstanding: number;
  credit: number;
  status: 'Owing' | 'Cleared' | 'Credit' | 'NotSet';
  termRows?: Array<{
    termId: number | null;
    termName: string;
    termFee: number;
    amountPaid: number;
    outstanding: number;
    isActiveTerm: boolean;
  }>;
};

export async function fetchStudentBalance(studentId: number | string): Promise<StudentBalance> {
  return apiService.get<StudentBalance>(
    `/fee-calculations/students/${encodeURIComponent(String(studentId))}/balance`
  );
}

export async function fetchClassStudentBalances(
  classId?: number | string | null
): Promise<{ activeTermLabel: string | null; balances: Record<string, StudentBalance> }> {
  const params = new URLSearchParams();
  if (classId != null && String(classId).trim() !== '') {
    params.set('classId', String(classId));
  }
  const qs = params.toString();
  return apiService.get(`/fee-calculations/students/balances${qs ? `?${qs}` : ''}`);
}

/** Format balance lines for display (records page / fee status). */
export function formatBalanceLines(b: StudentBalance) {
  const lines: Array<{ label: string; amount: number; kind: 'charge' | 'total' | 'paid' | 'outstanding' | 'divider' }> = [];

  const termLabel = b.currentTermName ?? 'Current term';
  lines.push({ label: `Term Fee (${termLabel})`, amount: b.currentTermFee, kind: 'charge' });

  for (const row of b.arrearLines) {
    lines.push({ label: `Arrears — ${row.termName}`, amount: row.amount, kind: 'charge' });
  }

  lines.push({ label: 'Total Due', amount: b.totalDue, kind: 'total' });

  for (const row of b.paidLines) {
    lines.push({ label: `Paid — ${row.termName}`, amount: -row.amount, kind: 'paid' });
  }

  lines.push({ label: 'Outstanding', amount: b.outstanding, kind: 'outstanding' });

  return lines;
}
