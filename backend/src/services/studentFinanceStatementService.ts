import { query } from '../db/connection.js';
import type { StudentTermBalance } from './studentUnifiedBalanceService.js';
import { resolveActiveLedgerTerm } from './studentUnifiedBalanceService.js';
import { getTermByTermLedgerSummary } from './ledgerBalanceService.js';
import { beneficiaryAdjustedFee, type BeneficiaryStudentRow } from '../utils/beneficiaryFee.js';
import {
  getFeeStructureItems,
  linesFromFeeStructureItems,
  loadActiveFeeStructureLinesBatch,
} from './feeStructureItemsService.js';
import { listStudentCharges } from './studentChargesService.js';

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
  individualCharges: IndividualChargeStatementLine[];
  individualChargesSubtotal: number;
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
    const outstanding = roundMoney(Math.max(0, row.outstanding));
    const credit = roundMoney(row.credit > 0 ? row.credit : Math.max(0, amountPaid - feeBilled));
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

/** All terms from ledger + fee structures — full history for official finance statement. */
async function loadAllTermRowsFromLedger(
  tenantId: number,
  studentId: number,
  classId: number | null
): Promise<StudentTermBalance[]> {
  const summary = await getTermByTermLedgerSummary(null, tenantId, studentId);
  const summaryByTerm = new Map(summary.map((r) => [r.termId, r]));

  let extraTermIds: number[] = [];
  if (classId) {
    const fsRes = await query(
      `SELECT DISTINCT lfs.term_id
       FROM ledger_fee_structures lfs
       WHERE lfs.tenant_id = $1 AND lfs.class_id = $2`,
      [tenantId, classId]
    );
    extraTermIds = fsRes.rows.map((r) => Number(r.term_id));
  }

  const allTermIds = [
    ...new Set([...summary.map((r) => r.termId), ...extraTermIds]),
  ].filter((id) => !Number.isNaN(id));

  if (allTermIds.length === 0) return [];

  const labelsRes = await query(
    `SELECT t.id, TRIM(t.name || ' ' || ay.name) AS term_label
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.tenant_id = $1 AND t.id = ANY($2::int[])
     ORDER BY ay.name ASC, t.name ASC`,
    [tenantId, allTermIds]
  );

  return labelsRes.rows.map((row) => {
    const termId = Number(row.id);
    const s = summaryByTerm.get(termId);
    const feeBilled = s?.feeBilled ?? 0;
    const amountPaid = s?.amountPaid ?? 0;
    const outstanding = s?.outstanding ?? 0;
    const credit = s?.credit ?? 0;
    return {
      termId,
      termName: String(row.term_label || '').trim(),
      academicYear: '',
      termFee: feeBilled,
      arrearsBroughtForward: 0,
      totalDue: roundMoney(feeBilled + outstanding - credit),
      totalPaid: amountPaid,
      outstanding,
      credit,
      status:
        s?.status === 'Owing'
          ? 'Owing'
          : s?.status === 'Credit'
            ? 'Credit'
            : s?.status === 'NotSet'
              ? 'NotSet'
              : 'Cleared',
      isCurrentTerm: false,
      entries: [],
    };
  });
}

function sumTermSummary(rows: TermSummaryRow[]): Omit<TermSummaryRow, 'termLabel' | 'status'> {
  return rows.reduce(
    (acc, r) => ({
      feeBilled: roundMoney(acc.feeBilled + r.feeBilled),
      amountPaid: roundMoney(acc.amountPaid + r.amountPaid),
      // Per-term outstanding and credit must not be summed across terms.
      outstanding: 0,
      credit: 0,
    }),
    { feeBilled: 0, amountPaid: 0, outstanding: 0, credit: 0 }
  );
}

function parseCarriedFromLabel(description: string, kind: 'arrears' | 'credit'): string | null {
  const text = String(description || '').trim();
  const re =
    kind === 'arrears'
      ? /^Arrears brought forward from\s+(.+)$/i
      : /^Credit carried forward from\s+(.+)$/i;
  const m = text.match(re);
  if (m) return m[1].trim();
  if (kind === 'arrears' && /arrears from previous term/i.test(text)) return 'Previous term';
  if (kind === 'credit' && /credit from previous term/i.test(text)) return 'Previous term';
  return null;
}

function originDedupeKey(
  metadata: Record<string, unknown> | undefined,
  description: string,
  kind: 'arrears' | 'credit'
): string {
  if (metadata?.carried_from_term_id != null && !Number.isNaN(Number(metadata.carried_from_term_id))) {
    return `term:${Number(metadata.carried_from_term_id)}`;
  }
  const parsed = parseCarriedFromLabel(description, kind);
  return parsed ? `label:${parsed.toLowerCase()}` : `desc:${description}`;
}

/** Arrears history — current term only, one line per originating term, no duplicates. */
async function buildArrearsHistoryFromLedger(
  tenantId: number,
  studentId: number,
  currentTermId: number | null
): Promise<ArrearsHistory> {
  if (!currentTermId) {
    return { lines: [], totalCarriedForward: 0 };
  }

  const res = await query(
    `SELECT sl.description, sl.debit, sl.metadata, sl.term_id,
            TRIM(t.name || ' ' || ay.name) AS term_label
     FROM student_ledger sl
     JOIN terms t ON t.id = sl.term_id AND t.tenant_id = sl.tenant_id
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE sl.tenant_id = $1 AND sl.student_id = $2
       AND sl.term_id = $3
       AND sl.entry_type = 'arrears'
       AND sl.debit > 0
     ORDER BY sl.created_at ASC, sl.id ASC`,
    [tenantId, studentId, currentTermId]
  );

  const seenOrigins = new Set<string>();
  const lines: ArrearsHistoryLine[] = [];

  for (const row of res.rows) {
    const meta = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<
      string,
      unknown
    >;
    const description = String(row.description || '');
    const originKey = originDedupeKey(meta, description, 'arrears');
    if (seenOrigins.has(originKey)) continue;
    seenOrigins.add(originKey);

    const amount = roundMoney(parseFloat(String(row.debit)) || 0);
    if (amount <= 0) continue;

    const originatedFrom = parseCarriedFromLabel(description, 'arrears') || 'Prior term';
    const carriedToLabel = String(row.term_label || '').trim() || null;

    lines.push({
      termLabel: originatedFrom,
      unpaidAmount: amount,
      carriedToLabel,
    });
  }

  const totalCarriedForward = roundMoney(
    lines.reduce((s, l) => s + l.unpaidAmount, 0)
  );

  return { lines, totalCarriedForward };
}

/** Credit history — current term only, carry_forward_credit with credit > 0, net remaining total. */
async function buildCreditHistoryFromLedger(
  tenantId: number,
  studentId: number,
  currentTermId: number | null
): Promise<CreditHistory> {
  if (!currentTermId) {
    return { lines: [], totalCreditAvailable: 0 };
  }

  const netRes = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN entry_type = 'carry_forward_credit' THEN credit ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN entry_type = 'credit_applied' THEN credit ELSE 0 END), 0) AS net_credit
     FROM student_ledger
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3`,
    [tenantId, studentId, currentTermId]
  );
  const netCredit = roundMoney(parseFloat(String(netRes.rows[0]?.net_credit)) || 0);
  if (netCredit <= 0.001) {
    return { lines: [], totalCreditAvailable: 0 };
  }

  const res = await query(
    `SELECT sl.description, sl.credit, sl.metadata,
            TRIM(t.name || ' ' || ay.name) AS term_label
     FROM student_ledger sl
     JOIN terms t ON t.id = sl.term_id AND t.tenant_id = sl.tenant_id
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE sl.tenant_id = $1 AND sl.student_id = $2
       AND sl.term_id = $3
       AND sl.entry_type = 'carry_forward_credit'
       AND sl.credit > 0
     ORDER BY sl.created_at ASC, sl.id ASC`,
    [tenantId, studentId, currentTermId]
  );

  const seenOrigins = new Set<string>();
  const lines: CreditHistoryLine[] = [];

  for (const row of res.rows) {
    const meta = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<
      string,
      unknown
    >;
    const description = String(row.description || '');
    const originKey = originDedupeKey(meta, description, 'credit');
    if (seenOrigins.has(originKey)) continue;
    seenOrigins.add(originKey);

    const creditAmount = roundMoney(parseFloat(String(row.credit)) || 0);
    if (creditAmount <= 0) continue;

    const originatedFrom = parseCarriedFromLabel(description, 'credit');
    lines.push({
      termLabel: originatedFrom || String(row.term_label || 'Term').trim(),
      creditAmount,
      description: originatedFrom
        ? `${originatedFrom} credit (overpayment carried forward)`
        : 'Credit (overpayment carried forward)',
    });
  }

  return { lines, totalCreditAvailable: netCredit };
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

  const termRows = await loadAllTermRowsFromLedger(tenantId, studentId, classId);
  const termSummary = buildTermSummaryRows(termRows);
  const termSummaryTotals = sumTermSummary(termSummary);

  const { ledgerTermId } = await resolveActiveLedgerTerm(query, tenantId);
  const arrearsHistory = await buildArrearsHistoryFromLedger(tenantId, studentId, ledgerTermId);
  const creditHistory = await buildCreditHistoryFromLedger(tenantId, studentId, ledgerTermId);

  const termIds = termRows.map((r) => r.termId);
  let feeStructureRows: Array<Record<string, unknown>> = [];
  if (classId && termIds.length > 0) {
    const fsRes = await query(
      `SELECT lfs.id, lfs.term_id, lfs.total,
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

  const feeStructureIds = feeStructureRows.map((row) => Number(row.id)).filter((id) => !Number.isNaN(id));
  const savedItemsByStructureId = await loadActiveFeeStructureLinesBatch(tenantId, feeStructureIds);

  // Load individual charges for the student and group by term so they can be
  // attached to each term block in the statement.
  const chargeRows = await listStudentCharges(tenantId, studentId, null);
  const termLabelById = new Map(termRows.map((r) => [r.termId, r.termName]));
  const individualCharges: IndividualChargeStatementLine[] = chargeRows.map((c) => ({
    id: c.id,
    termId: c.termId,
    termLabel: termLabelById.get(c.termId) || 'Term',
    description: c.description,
    amount: c.amount,
    date: c.createdAt.split('T')[0],
    addedBy: c.createdByName,
    status: c.status,
    reason: c.reason,
  }));
  const individualChargesSubtotal = roundMoney(
    individualCharges.reduce((sum, line) => sum + line.amount, 0)
  );

  const chargesByTerm = new Map<number, IndividualChargeStatementLine[]>();
  for (const ch of individualCharges) {
    const list = chargesByTerm.get(ch.termId) || [];
    list.push(ch);
    chargesByTerm.set(ch.termId, list);
  }

  const feeBreakdown: TermFeeBreakdown[] = await Promise.all(
    termRows.map(async (row) => {
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
        individualCharges: [],
        termTotal: 0,
      };
    }

    if (!fs) {
      return {
        termId: row.termId,
        termLabel: row.termName,
        className,
        lines: netBilled > 0 ? [{ label: 'Total Term Bill', amount: netBilled }] : [],
        subtotal: netBilled,
        discountAmount: 0,
        discountLabel: null,
        netBilled,
        noFeeStructure: false,
        individualCharges: [],
        termTotal: netBilled,
      };
    }

    const feeStructureId = Number(fs.id);
    let lines = savedItemsByStructureId.get(feeStructureId) || [];
    if (lines.length === 0) {
      const items = await getFeeStructureItems(tenantId, feeStructureId);
      lines = items ? linesFromFeeStructureItems(items) : [];
    }
    const structureSubtotal = roundMoney(
      lines.reduce((s, l) => s + l.amount, 0) || parseFloat(String(fs.total)) || 0
    );
    const { discountAmount } = beneficiaryAdjustedFee(structureSubtotal, beneficiary);
    const discountAmountRounded = roundMoney(discountAmount);
    const termIndividualCharges = chargesByTerm.get(row.termId) || [];
    const termChargesSum = roundMoney(termIndividualCharges.reduce((s, c) => s + c.amount, 0));
    // Avoid double-counting individual charges: `netBilled` (from ledger) may already
    // include student_charge entries. When we have a fee structure, derive the term
    // total from the structure subtotal (fee items) minus discounts plus individual
    // charges. When no fee structure is present, fall back to netBilled which already
    // represents ledger-calculated total.
    const termTotal = roundMoney(structureSubtotal - discountAmountRounded + termChargesSum);
    return {
      termId: row.termId,
      termLabel: row.termName,
      className,
      lines: lines.length > 0 ? lines : netBilled > 0 ? [{ label: 'Total Term Bill', amount: netBilled }] : [],
      subtotal: structureSubtotal,
      discountAmount: roundMoney(discountAmount),
      discountLabel: discountAmount > 0 ? formatDiscountLabel(beneficiary) : null,
      netBilled,
      noFeeStructure: false,
      individualCharges: termIndividualCharges,
      termTotal,
    };
  })
  );
  const grandTotalFeesBilled = roundMoney(
    feeBreakdown.reduce((s, t) => s + (t.termTotal ?? t.netBilled ?? 0), 0)
  );

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
  const totalAmountPaid = termSummaryTotals.amountPaid;
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
    individualCharges,
    individualChargesSubtotal,
    grandTotalFeesBilled,
    termSummary,
    termSummaryTotals,
    arrearsHistory,
    creditHistory,
    payments,
    paymentsTotal,
    adjustments,
    adjustmentsTotal,
    accountSummary,
    variant,
  };
}
