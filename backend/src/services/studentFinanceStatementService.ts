import { query } from '../db/connection.js';
import {
  getStudentFullBalance,
  computeTermOwnOutstanding,
  type StudentTermBalance,
} from './studentUnifiedBalanceService.js';
import { beneficiaryAdjustedFee, type BeneficiaryStudentRow } from '../utils/beneficiaryFee.js';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type FinanceStatementVariant = 'official' | 'parent_portal';

export type TermFeeBreakdownLine = {
  label: string;
  amount: number;
};

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
};

export type TermSummaryRow = {
  termLabel: string;
  feeBilled: number;
  amountPaid: number;
  outstanding: number;
  credit: number;
  status: 'Cleared' | 'Owing' | 'Credit';
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
    academicYear: string;
    dateGenerated: string;
    generatedBy: string | null;
    generatedByRole: string | null;
  };
  feeBreakdown: TermFeeBreakdown[];
  grandTotalFeesBilled: number;
  termSummary: TermSummaryRow[];
  termSummaryTotals: Omit<TermSummaryRow, 'termLabel' | 'status'>;
  arrearsHistory: ArrearsHistory;
  payments: StatementPaymentRow[];
  paymentsTotal: number;
  adjustments: StatementAdjustmentRow[];
  adjustmentsTotal: number;
  accountSummary: AccountSummary;
  variant: FinanceStatementVariant;
};

function deriveRowStatus(outstanding: number, credit: number): 'Cleared' | 'Owing' | 'Credit' {
  if (credit > 0.001) return 'Credit';
  if (outstanding > 0.001) return 'Owing';
  return 'Cleared';
}

function formatDiscountLabel(student: BeneficiaryStudentRow): string | null {
  if (!student.is_beneficiary) return null;
  const type = String(student.discount_type ?? '')
    .trim()
    .toLowerCase();
  if (!type) return 'Beneficiary Discount (100%)';
  if (type === 'percentage') return `Beneficiary Discount (${student.discount_value}%)`;
  if (type === 'fixed') return `Beneficiary Discount (GHS ${student.discount_value})`;
  return 'Beneficiary Discount';
}

function buildTermSummaryRows(termRows: StudentTermBalance[]): TermSummaryRow[] {
  return termRows.map((row) => {
    const feeBilled = row.termFee;
    const amountPaid = row.totalPaid;
    const outstanding = roundMoney(Math.max(0, feeBilled - amountPaid));
    const credit = roundMoney(Math.max(0, amountPaid - feeBilled));
    return {
      termLabel: row.termName,
      feeBilled,
      amountPaid,
      outstanding,
      credit,
      status: deriveRowStatus(outstanding, credit),
    };
  });
}

function sumTermSummary(rows: TermSummaryRow[]): Omit<TermSummaryRow, 'termLabel' | 'status'> {
  return rows.reduce(
    (acc, r) => ({
      feeBilled: roundMoney(acc.feeBilled + r.feeBilled),
      amountPaid: roundMoney(acc.amountPaid + r.amountPaid),
      outstanding: roundMoney(acc.outstanding + r.outstanding),
      credit: roundMoney(acc.credit + r.credit),
    }),
    { feeBilled: 0, amountPaid: 0, outstanding: 0, credit: 0 }
  );
}

/** Informational only — shows which prior terms had unpaid balances carried to the next term. */
function buildArrearsHistory(termSummary: TermSummaryRow[]): ArrearsHistory {
  const lines: ArrearsHistoryLine[] = [];
  for (let i = 0; i < termSummary.length - 1; i++) {
    const row = termSummary[i];
    const unpaid = computeTermOwnOutstanding(row.feeBilled, row.amountPaid);
    if (unpaid > 0) {
      lines.push({
        termLabel: row.termLabel,
        unpaidAmount: unpaid,
        carriedToLabel: termSummary[i + 1]?.termLabel ?? null,
      });
    }
  }
  return {
    lines,
    totalCarriedForward: roundMoney(lines.reduce((s, l) => s + l.unpaidAmount, 0)),
  };
}

function mapAdjustmentType(row: Record<string, unknown>): string {
  const category = String(row.adjustment_category || '').trim();
  if (category) return category;
  const meta = row.metadata as Record<string, unknown> | undefined;
  const metaType = String(meta?.type || '').trim();
  if (metaType === 'ARREARS_WRITE_OFF') return 'Arrears Write-Off';
  const desc = String(row.description || '').toLowerCase();
  if (desc.includes('write-off') || desc.includes('write off')) return 'Arrears Write-Off';
  if (desc.includes('waiver') || desc.includes('discount')) return 'Beneficiary Discount';
  return 'Manual Adjustment';
}

function roleDisplayName(role: string | null | undefined): string | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r === 'super-admin') return 'Super Administrator';
  if (r === 'administrator') return 'Administrator';
  if (r === 'finance') return 'Finance Officer';
  return role;
}

export async function buildStudentFinanceStatement(
  tenantId: number,
  studentId: number,
  opts: {
    variant?: FinanceStatementVariant;
    generatedByName?: string | null;
    generatedByRole?: string | null;
  } = {}
): Promise<StudentFinanceStatement | null> {
  const variant = opts.variant ?? 'official';

  const studentRes = await query(
    `SELECT s.id, s.first_name, s.last_name, s.student_id, s.admission_number,
            s.is_beneficiary, s.discount_type, s.discount_value, s.class_assigned_id,
            c.class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id
     WHERE s.id = $1 AND s.tenant_id = $2`,
    [studentId, tenantId]
  );
  if (studentRes.rows.length === 0) return null;
  const student = studentRes.rows[0];
  const classId = student.class_assigned_id ? Number(student.class_assigned_id) : null;
  const className = String(student.class_name || '—');
  const beneficiary: BeneficiaryStudentRow = {
    is_beneficiary: student.is_beneficiary,
    discount_type: student.discount_type,
    discount_value: student.discount_value,
  };

  const settingsRes = await query(
    `SELECT ss.school_name, ss.current_year, ss.current_term,
            COALESCE(NULLIF(ss.physical_address, ''), ss.address, ss.postal_address, '') AS address,
            COALESCE(NULLIF(ss.contact_phone, ''), ss.phone_number, ss.contact, '') AS phone,
            COALESCE(ss.email, '') AS email,
            COALESCE(NULLIF(ss.logo_url, ''), t.logo_url) AS logo_url
     FROM school_settings ss
     LEFT JOIN tenants t ON t.id = ss.tenant_id
     WHERE ss.tenant_id = $1`,
    [tenantId]
  );
  const settings = settingsRes.rows[0] || {};

  const fullBalance = await getStudentFullBalance(null, tenantId, studentId);
  const termRows = fullBalance?.termRows ?? [];
  const termSummary = buildTermSummaryRows(termRows);
  const termSummaryTotals = sumTermSummary(termSummary);
  const arrearsHistory = buildArrearsHistory(termSummary);

  const termIds = termRows.map((r) => r.termId);
  let feeStructureRows: Array<Record<string, unknown>> = [];
  if (classId && termIds.length > 0) {
    const fsRes = await query(
      `SELECT lfs.term_id, lfs.tuition_fee, lfs.pta_fee, lfs.exam_fee, lfs.total,
              t.name AS term_part, ay.name AS year_part
       FROM ledger_fee_structures lfs
       JOIN terms t ON t.id = lfs.term_id
       JOIN academic_years ay ON ay.id = lfs.academic_year_id
       WHERE lfs.tenant_id = $1 AND lfs.class_id = $2 AND lfs.term_id = ANY($3::int[])
       ORDER BY ay.name ASC, t.name ASC`,
      [tenantId, classId, termIds]
    );
    feeStructureRows = fsRes.rows;
  }

  const feeStructureByTerm = new Map<number, Record<string, unknown>>();
  for (const row of feeStructureRows) {
    feeStructureByTerm.set(Number(row.term_id), row);
  }

  const feeBreakdown: TermFeeBreakdown[] = termRows.map((row) => {
    const fs = feeStructureByTerm.get(row.termId);
    const netBilled = roundMoney(row.termFee);

    if (!fs && netBilled <= 0) {
      return {
        termId: row.termId,
        termLabel: row.termName,
        className,
        lines: [],
        subtotal: 0,
        discountAmount: 0,
        discountLabel: null,
        netBilled: 0,
        noFeeStructure: true,
      };
    }

    if (!fs) {
      return {
        termId: row.termId,
        termLabel: row.termName,
        className,
        lines: netBilled > 0 ? [{ label: 'Tuition Fee', amount: netBilled }] : [],
        subtotal: netBilled,
        discountAmount: 0,
        discountLabel: null,
        netBilled,
        noFeeStructure: false,
      };
    }

    const tuition = roundMoney(parseFloat(String(fs.tuition_fee)) || 0);
    const pta = roundMoney(parseFloat(String(fs.pta_fee)) || 0);
    const exam = roundMoney(parseFloat(String(fs.exam_fee)) || 0);
    const lines: TermFeeBreakdownLine[] = [];
    if (tuition > 0) lines.push({ label: 'Tuition Fee', amount: tuition });
    if (pta > 0) lines.push({ label: 'PTA Levy', amount: pta });
    if (exam > 0) lines.push({ label: 'Exam Fee', amount: exam });
    const structureSubtotal = roundMoney(
      lines.reduce((s, l) => s + l.amount, 0) || parseFloat(String(fs.total)) || 0
    );
    const { discountAmount } = beneficiaryAdjustedFee(structureSubtotal, beneficiary);
    return {
      termId: row.termId,
      termLabel: row.termName,
      className,
      lines: lines.length > 0 ? lines : netBilled > 0 ? [{ label: 'Tuition Fee', amount: netBilled }] : [],
      subtotal: structureSubtotal,
      discountAmount: roundMoney(discountAmount),
      discountLabel: discountAmount > 0 ? formatDiscountLabel(beneficiary) : null,
      netBilled,
      noFeeStructure: false,
    };
  });

  const grandTotalFeesBilled = roundMoney(termSummaryTotals.feeBilled);

  const paymentsRes = await query(
    `SELECT p.id, p.payment_date, p.amount, p.term, p.receipt_number, p.payment_method,
            p.is_voided, p.corrects_payment_id, p.corrected_by_payment_id,
            orig.receipt_number AS original_receipt_number,
            repl.receipt_number AS replacement_receipt_number,
            COALESCE(pa.account_name, p.payment_method, 'Cash') AS method_label
     FROM payments p
     LEFT JOIN payment_accounts pa ON pa.id = p.payment_account_id
     LEFT JOIN payments orig ON orig.id = p.corrects_payment_id
     LEFT JOIN payments repl ON repl.id = p.corrected_by_payment_id
     WHERE p.tenant_id = $1 AND p.student_id = $2
     ORDER BY p.payment_date ASC, p.id ASC`,
    [tenantId, studentId]
  );

  const payments: StatementPaymentRow[] = paymentsRes.rows.map((p: Record<string, unknown>) => {
    const isVoided = !!p.is_voided;
    const isCorrected = !!p.corrects_payment_id;
    return {
      id: Number(p.id),
      receiptNumber: String(p.receipt_number || '—'),
      date: p.payment_date instanceof Date ? p.payment_date.toISOString().split('T')[0] : String(p.payment_date || ''),
      term: String(p.term || '—'),
      amount: roundMoney(parseFloat(String(p.amount)) || 0),
      method: String(p.method_label || p.payment_method || 'Cash'),
      isVoided,
      isCorrected,
      replacesReceiptNumber: p.original_receipt_number ? String(p.original_receipt_number) : null,
      correctedByReceiptNumber: p.replacement_receipt_number ? String(p.replacement_receipt_number) : null,
    };
  });

  const paymentsTotal = roundMoney(
    payments.filter((p) => !p.isVoided).reduce((s, p) => s + p.amount, 0)
  );

  const adjustmentsRes = await query(
    `SELECT sl.created_at, sl.description, sl.debit, sl.credit, sl.adjustment_category,
            sl.adjustment_notes, sl.metadata
     FROM student_ledger sl
     WHERE sl.tenant_id = $1 AND sl.student_id = $2 AND sl.entry_type = 'manual_adjustment'
     ORDER BY sl.created_at ASC, sl.id ASC`,
    [tenantId, studentId]
  );

  const adjustments: StatementAdjustmentRow[] = adjustmentsRes.rows.map((r: Record<string, unknown>) => {
    const credit = roundMoney(parseFloat(String(r.credit)) || 0);
    const debit = roundMoney(parseFloat(String(r.debit)) || 0);
    const amount = roundMoney(Math.max(credit, debit));
    const reason = String(r.adjustment_notes || r.description || '—').trim();
    const date =
      r.created_at instanceof Date
        ? r.created_at.toISOString().split('T')[0]
        : String(r.created_at || '').split('T')[0];
    return {
      date,
      type: mapAdjustmentType(r),
      amount,
      reason,
    };
  });

  const adjustmentsTotal = roundMoney(adjustments.reduce((s, a) => s + a.amount, 0));

  const totalFeesBilled = termSummaryTotals.feeBilled;
  const totalAmountPaid = paymentsTotal;
  const balanceDelta = roundMoney(totalFeesBilled - totalAmountPaid);
  let accountStatus: AccountSummary['accountStatus'] = 'CLEARED';
  let balanceKind: AccountSummary['balanceKind'] = 'NONE';
  let currentBalance = 0;
  let statusLabel = '✓ FULLY PAID';

  if (balanceDelta < -0.001) {
    accountStatus = 'CREDIT';
    balanceKind = 'CR';
    currentBalance = roundMoney(Math.abs(balanceDelta));
    statusLabel = `✓ CREDIT BALANCE — GHS ${currentBalance.toFixed(2)}`;
  } else if (balanceDelta > 0.001) {
    accountStatus = 'OWING';
    balanceKind = 'DR';
    currentBalance = balanceDelta;
    statusLabel = `⚠ OUTSTANDING — GHS ${currentBalance.toFixed(2)}`;
  }

  const accountSummary: AccountSummary = {
    totalFeesBilled,
    totalAmountPaid,
    currentBalance,
    balanceKind,
    accountStatus,
    statusLabel,
  };

  const now = new Date();
  const dateGenerated = now.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return {
    header: {
      schoolName: String(settings.school_name || 'School'),
      logoUrl: settings.logo_url ? String(settings.logo_url) : null,
      address: String(settings.address || '—'),
      phone: String(settings.phone || '—'),
      email: String(settings.email || '—'),
      studentName: `${student.first_name} ${student.last_name}`.trim(),
      studentId: String(student.student_id || '—'),
      admissionNo: String(student.admission_number || student.student_id || '—'),
      className,
      academicYear: String(settings.current_year || '—'),
      dateGenerated,
      generatedBy: variant === 'parent_portal' ? null : opts.generatedByName ?? null,
      generatedByRole:
        variant === 'parent_portal' ? null : roleDisplayName(opts.generatedByRole ?? null),
    },
    feeBreakdown,
    grandTotalFeesBilled,
    termSummary,
    termSummaryTotals,
    arrearsHistory,
    payments,
    paymentsTotal,
    adjustments,
    adjustmentsTotal,
    accountSummary,
    variant,
  };
}
