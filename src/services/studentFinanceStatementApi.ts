import { apiService } from './api';

export type TermFeeBreakdownLine = { label: string; amount: number };

export type TermFeeBreakdown = {
  termId: number;
  termLabel: string;
  className: string;
  lines: TermFeeBreakdownLine[];
  subtotal: number;
  discountAmount: number;
  discountLabel: string | null;
  netBilled: number;
  noFeeStructure: boolean;
  individualCharges?: IndividualChargeStatementLine[];
  termTotal?: number;
};

export type TermSummaryRow = {
  termLabel: string;
  feeBilled: number;
  amountPaid: number;
  outstanding: number;
  credit: number;
  status: 'Cleared' | 'Owing' | 'Credit';
};

export type IndividualChargeStatementLine = {
  id: number;
  termId: number;
  termLabel: string;
  description: string;
  amount: number;
  date: string;
  addedBy: string | null;
  status: 'paid' | 'unpaid';
  reason: string | null;
};

export type ArrearsHistoryLine = {
  termLabel: string;
  unpaidAmount: number;
  carriedToLabel: string | null;
};

export type ArrearsHistory = {
  lines: ArrearsHistoryLine[];
  totalCarriedForward: number;
};

export type CreditHistoryLine = {
  termLabel: string;
  creditAmount: number;
  description: string;
};

export type CreditHistory = {
  lines: CreditHistoryLine[];
  totalCreditAvailable: number;
};

export type StatementPaymentRow = {
  id: number;
  receiptNumber: string;
  date: string;
  term: string;
  amount: number;
  method: string;
  isVoided: boolean;
  isCorrected: boolean;
  replacesReceiptNumber: string | null;
  correctedByReceiptNumber: string | null;
};

export type StatementAdjustmentRow = {
  date: string;
  type: string;
  amount: number;
  reason: string;
};

export type AccountSummary = {
  totalFeesBilled: number;
  totalAmountPaid: number;
  currentBalance: number;
  balanceKind: 'CR' | 'DR' | 'NONE';
  accountStatus: 'CLEARED' | 'OWING' | 'CREDIT';
  statusLabel: string;
};

export type StudentFinanceStatement = {
  header: {
    schoolName: string;
    logoUrl: string | null;
    address: string;
    phone: string;
    email: string;
    studentName: string;
    studentId: string;
    admissionNo: string;
    className: string;
    photoUrl: string | null;
    academicYear: string;
    dateGenerated: string;
    generatedBy: string | null;
    generatedByRole: string | null;
    signatoryName: string | null;
    signatoryTitle: string | null;
    signatureImage: string | null;
    stampImage: string | null;
  };
  feeBreakdown: TermFeeBreakdown[];
  individualCharges?: IndividualChargeStatementLine[];
  individualChargesSubtotal?: number;
  grandTotalFeesBilled: number;
  termSummary: TermSummaryRow[];
  termSummaryTotals: Omit<TermSummaryRow, 'termLabel' | 'status'>;
  arrearsHistory: ArrearsHistory;
  creditHistory: CreditHistory;
  payments: StatementPaymentRow[];
  paymentsTotal: number;
  adjustments: StatementAdjustmentRow[];
  adjustmentsTotal: number;
  accountSummary: AccountSummary;
  variant: 'official' | 'parent_portal';
};

export async function fetchStudentFinanceStatement(studentId: number | string): Promise<StudentFinanceStatement> {
  const res = await apiService.get<{ statement: StudentFinanceStatement }>(
    `/finance/students/${encodeURIComponent(String(studentId))}/statement`
  );
  return res.statement;
}

export async function logFinanceStatementDownload(studentId: number | string): Promise<void> {
  await apiService.post(`/finance/students/${encodeURIComponent(String(studentId))}/statement/download`, {});
}

export async function sendFinanceStatementToParent(studentId: number | string): Promise<{
  ok: boolean;
  parentAccounts: number;
  subscribedAccounts: number;
}> {
  return apiService.post(`/finance/students/${encodeURIComponent(String(studentId))}/statement/send-to-parent`, {});
}

export function isFinanceStatementNotificationUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.includes('openStatement=1') || url.includes('finance-statement');
}

const PARENT_API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export async function fetchParentFinanceStatement(token: string): Promise<StudentFinanceStatement> {
  const res = await fetch(`${PARENT_API}/parent/finance-statement`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = 'Failed to load finance statement';
    try {
      const j = text.trim() ? JSON.parse(text) : {};
      msg = j.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const data = text.trim() ? (JSON.parse(text) as { statement: StudentFinanceStatement }) : { statement: null as unknown as StudentFinanceStatement };
  return data.statement;
}
