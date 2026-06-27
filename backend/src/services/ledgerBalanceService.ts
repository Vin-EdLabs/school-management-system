import type pg from 'pg';
import { query } from '../db/connection.js';
import { resolveActiveLedgerTerm } from './studentUnifiedBalanceService.js';
import { listStudentCharges } from './studentChargesService.js';
import { enrichBalanceShapeWithExpectedFees } from './effectiveStudentBalanceService.js';

type QueryFn = typeof query;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Only term-fee rows in `payments` — excludes daily fee collections. */
export const TERM_PAYMENT_CATEGORY_SQL = `COALESCE(p.payment_category, 'term_fee') = 'term_fee'`;

/** Exclude daily_fee mirror credits synced into student_ledger from term balance math. */
export const LEDGER_TERM_CREDIT_SQL = `CASE
  WHEN sl.payment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM payments p
    WHERE p.id = sl.payment_id AND p.payment_category = 'daily_fee'
  ) THEN 0
  ELSE sl.credit
END`;

export const LEDGER_TERM_CREDIT_SQL_UNALIASED = `CASE
  WHEN payment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM payments p
    WHERE p.id = student_ledger.payment_id AND p.payment_category = 'daily_fee'
  ) THEN 0
  ELSE credit
END`;

/** Active students in term-fee classes only (daily fee classes use a separate system). */
export const TERM_FEE_CLASS_FILTER_SQL = `COALESCE(c.fee_mode, 'term') != 'daily'`;

/** Carried credit visible in the current term (not consumed until term close). */
export const CREDIT_AVAILABLE_ENTRY_TYPES = ['carry_forward_credit', 'credit_brought_forward'] as const;

const CREDIT_AVAILABLE_SQL = CREDIT_AVAILABLE_ENTRY_TYPES.map((t) => `'${t}'`).join(', ');

export type LedgerBalance = {
  termFee: number;
  /** One-time individual charges (student_charge ledger entries). */
  individualCharges: number;
  arrears: number;
  /** carry_forward_credit only — shown in Credit column */
  creditFromCarryForward: number;
  paymentsMade: number;
  /** term_fee + arrears — credit is NOT subtracted */
  totalDue: number;
  totalPaid: number;
  /** max(0, netBalance) — amount still owed for payments */
  outstanding: number;
  /** Same as creditFromCarryForward for display */
  creditBalance: number;
  /** SUM(debit) - SUM(credit) for the term */
  netBalance: number;
  rawBalance: number;
  totalCharged: number;
};

export type ArrearsBreakdownLine = {
  description: string;
  amount: number;
  entryType: string;
  date: string;
};

export type CreditBreakdownLine = {
  description: string;
  amount: number;
  entryType: string;
  date: string;
};

export type BatchStudentLedgerBalance = {
  id: number;
  firstName: string;
  lastName: string;
  studentId: string;
  admissionNumber: string;
  className: string;
  termFee: number;
  individualCharges: number;
  arrears: number;
  creditBroughtForward: number;
  amountPaidThisTerm: number;
  totalDue: number;
  balance: number;
  outstanding: number;
  creditBalance: number;
  netBalance: number;
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

/**
 * Master balance function — current-term isolated view.
 * Total Due = term_fee + arrears only. Credit shown separately.
 * Net balance = full ledger SUM(debit) - SUM(credit).
 */
export async function getStudentBalanceFromLedger(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId?: number | null
): Promise<LedgerBalance> {
  const run: QueryFn = client ? client.query.bind(client) : query;

  const params: unknown[] = [studentId, tenantId];
  let termFilter = '';
  if (termId != null && !Number.isNaN(Number(termId))) {
    termFilter = 'AND term_id = $3';
    params.push(termId);
  }

  const res = await run(
    `SELECT
       COALESCE(SUM(CASE WHEN entry_type = 'term_fee' THEN debit ELSE 0 END), 0) AS term_fee,
       COALESCE(SUM(CASE WHEN entry_type = 'student_charge' THEN debit ELSE 0 END), 0) AS individual_charges,
       COALESCE(SUM(CASE WHEN entry_type = 'arrears' THEN debit ELSE 0 END), 0) AS arrears,
       COALESCE(SUM(CASE WHEN entry_type IN (${CREDIT_AVAILABLE_SQL}) THEN credit ELSE 0 END), 0) AS credit_available,
       COALESCE(SUM(CASE WHEN entry_type = 'payment' THEN (${LEDGER_TERM_CREDIT_SQL_UNALIASED}) ELSE 0 END), 0) AS payments_made,
       COALESCE(SUM(debit), 0) - COALESCE(SUM(${LEDGER_TERM_CREDIT_SQL_UNALIASED}), 0) AS net_balance,
       COALESCE((
         SELECT SUM(p.amount)::numeric
         FROM payments p
         WHERE p.tenant_id = $2
           AND p.student_id = $1
           AND p.term_id = $3
           AND COALESCE(p.is_voided, false) = false
           AND COALESCE(p.payment_category, 'term_fee') = 'term_fee'
       ), 0) AS payments_table_total
     FROM student_ledger
     WHERE student_id = $1 AND tenant_id = $2 ${termFilter}`,
    termId != null && !Number.isNaN(Number(termId)) ? [studentId, tenantId, termId] : params
  );

  const row = res.rows[0] || {};
  const termFee = roundMoney(parseFloat(row.term_fee) || 0);
  const individualCharges = roundMoney(parseFloat(row.individual_charges) || 0);
  const arrears = roundMoney(parseFloat(row.arrears) || 0);
  const creditFromCarryForward = roundMoney(parseFloat(row.credit_available) || 0);
  const ledgerPaymentsMade = roundMoney(parseFloat(row.payments_made) || 0);
  const paymentsTableTotal =
    termId != null && !Number.isNaN(Number(termId))
      ? roundMoney(parseFloat(row.payments_table_total) || 0)
      : 0;
  const paymentsMade = roundMoney(Math.max(ledgerPaymentsMade, paymentsTableTotal));
  const paymentGap = roundMoney(Math.max(0, paymentsMade - ledgerPaymentsMade));
  const netBalance = roundMoney((parseFloat(row.net_balance) || 0) - paymentGap);
  const totalDue = roundMoney(termFee + individualCharges + arrears);
  const outstanding = roundMoney(Math.max(0, netBalance));
  /** Overpayment in the current term (or net credit after payments) — not the same as brought-forward credit lines. */
  const creditBalance = roundMoney(netBalance < -0.001 ? Math.abs(netBalance) : 0);

  return {
    termFee,
    individualCharges,
    arrears,
    creditFromCarryForward,
    paymentsMade,
    totalDue,
    totalPaid: paymentsMade,
    outstanding,
    creditBalance,
    netBalance,
    rawBalance: netBalance,
    totalCharged: totalDue,
  };
}

/** Arrears breakdown — ONLY entry_type = 'arrears'. */
export async function getArrearsBreakdownFromLedger(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId?: number | null
): Promise<ArrearsBreakdownLine[]> {
  const run: QueryFn = client ? client.query.bind(client) : query;

  const params: unknown[] = [studentId, tenantId];
  let termFilter = '';
  if (termId != null && !Number.isNaN(Number(termId))) {
    termFilter = 'AND term_id = $3';
    params.push(termId);
  }

  const res = await run(
    `SELECT description, debit, entry_type, created_at
     FROM student_ledger
     WHERE student_id = $1 AND tenant_id = $2
       AND entry_type = 'arrears'
       ${termFilter}
     ORDER BY created_at ASC`,
    params
  );

  return res.rows.map((row) => ({
    description: String(row.description || 'Arrears'),
    amount: roundMoney(parseFloat(row.debit) || 0),
    entryType: String(row.entry_type || 'arrears'),
    date:
      row.created_at instanceof Date
        ? row.created_at.toISOString().split('T')[0]
        : String(row.created_at || '').split('T')[0],
  }));
}

/** Credit breakdown — carry_forward_credit and credit_applied (statement history). */
export async function getCreditBreakdownFromLedger(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId?: number | null
): Promise<CreditBreakdownLine[]> {
  const run: QueryFn = client ? client.query.bind(client) : query;

  const params: unknown[] = [studentId, tenantId];
  let termFilter = '';
  if (termId != null && !Number.isNaN(Number(termId))) {
    termFilter = 'AND term_id = $3';
    params.push(termId);
  }

  const res = await run(
    `SELECT description, credit, entry_type, created_at
     FROM student_ledger
     WHERE student_id = $1 AND tenant_id = $2
       AND entry_type IN ('carry_forward_credit', 'credit_applied')
       ${termFilter}
     ORDER BY created_at ASC`,
    params
  );

  return res.rows.map((row) => ({
    description: String(row.description || 'Credit'),
    amount: roundMoney(parseFloat(row.credit) || 0),
    entryType: String(row.entry_type || 'carry_forward_credit'),
    date:
      row.created_at instanceof Date
        ? row.created_at.toISOString().split('T')[0]
        : String(row.created_at || '').split('T')[0],
  }));
}

/** Batch balances for all active students — current term only. */
export async function getBatchStudentBalancesFromLedger(
  client: pg.PoolClient | null,
  tenantId: number,
  termId: number,
  classId?: number | null
): Promise<BatchStudentLedgerBalance[]> {
  const run: QueryFn = client ? client.query.bind(client) : query;

  const params: unknown[] = [tenantId, termId];
  let classFilter = '';
  if (classId != null && !Number.isNaN(Number(classId))) {
    classFilter = ` AND s.class_assigned_id = $${params.length + 1}`;
    params.push(classId);
  }

  const res = await run(
    `SELECT
       s.id,
       s.first_name,
       s.last_name,
       s.student_id,
       s.admission_number,
       c.class_name,
       COALESCE(SUM(CASE WHEN sl.entry_type = 'term_fee' THEN sl.debit ELSE 0 END), 0) AS term_fee,
       COALESCE(SUM(CASE WHEN sl.entry_type = 'student_charge' THEN sl.debit ELSE 0 END), 0) AS individual_charges,
       COALESCE(SUM(CASE WHEN sl.entry_type = 'arrears' THEN sl.debit ELSE 0 END), 0) AS arrears,
       COALESCE(SUM(CASE WHEN sl.entry_type IN (${CREDIT_AVAILABLE_SQL}) THEN sl.credit ELSE 0 END), 0) AS credit_brought_forward,
       COALESCE(SUM(CASE WHEN sl.entry_type = 'payment' THEN (${LEDGER_TERM_CREDIT_SQL}) ELSE 0 END), 0) AS ledger_paid,
       COALESCE(SUM(sl.debit), 0) - COALESCE(SUM(${LEDGER_TERM_CREDIT_SQL}), 0) AS net_balance,
       COALESCE(pay_sum.paid, 0) AS payments_table_total
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
     LEFT JOIN student_ledger sl ON sl.student_id = s.id
       AND sl.tenant_id = s.tenant_id
       AND sl.term_id = $2
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(p.amount), 0)::numeric AS paid
       FROM payments p
       WHERE p.tenant_id = s.tenant_id
         AND p.student_id = s.id
         AND p.term_id = $2
         AND COALESCE(p.is_voided, false) = false
         AND COALESCE(p.payment_category, 'term_fee') = 'term_fee'
     ) pay_sum ON true
     WHERE s.tenant_id = $1
       AND COALESCE(s.enrollment_status, 'active') = 'active'
       AND ${TERM_FEE_CLASS_FILTER_SQL}
       ${classFilter}
     GROUP BY s.id, s.first_name, s.last_name, s.student_id, s.admission_number, c.class_name, pay_sum.paid
     ORDER BY GREATEST(0, COALESCE(SUM(sl.debit), 0) - COALESCE(SUM(${LEDGER_TERM_CREDIT_SQL}), 0)) DESC`,
    params
  );

  return res.rows.map((row) => {
    const termFee = roundMoney(parseFloat(row.term_fee) || 0);
    const individualCharges = roundMoney(parseFloat(row.individual_charges) || 0);
    const arrears = roundMoney(parseFloat(row.arrears) || 0);
    const creditBroughtForward = roundMoney(parseFloat(row.credit_brought_forward) || 0);
    const ledgerPaid = roundMoney(parseFloat(row.ledger_paid) || 0);
    const paymentsTableTotal = roundMoney(parseFloat(row.payments_table_total) || 0);
    const amountPaidThisTerm = roundMoney(Math.max(ledgerPaid, paymentsTableTotal));
    const paymentGap = roundMoney(Math.max(0, amountPaidThisTerm - ledgerPaid));
    const netBalance = roundMoney((parseFloat(row.net_balance) || 0) - paymentGap);
    const totalDue = roundMoney(termFee + individualCharges + arrears);
    const outstanding = roundMoney(Math.max(0, netBalance));
    const creditBalance = roundMoney(netBalance < -0.001 ? Math.abs(netBalance) : 0);
    return {
      id: Number(row.id),
      firstName: String(row.first_name || ''),
      lastName: String(row.last_name || ''),
      studentId: String(row.student_id || ''),
      admissionNumber: String(row.admission_number || ''),
      className: String(row.class_name || ''),
      termFee,
      individualCharges,
      arrears,
      creditBroughtForward,
      amountPaidThisTerm,
      totalDue,
      balance: outstanding,
      outstanding,
      creditBalance,
      netBalance,
    };
  });
}

/** Per-term summary for student statement (full history). */
export async function getTermByTermLedgerSummary(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number
): Promise<TermLedgerSummaryRow[]> {
  const run: QueryFn = client ? client.query.bind(client) : query;
  const res = await run(
    `SELECT
       t.id AS term_id,
       TRIM(t.name || ' ' || ay.name) AS term_label,
       COALESCE(SUM(CASE WHEN sl.entry_type IN ('term_fee', 'student_charge') THEN sl.debit ELSE 0 END), 0) AS fee_billed,
       COALESCE(SUM(CASE WHEN sl.entry_type = 'payment' THEN (${LEDGER_TERM_CREDIT_SQL}) ELSE 0 END), 0) AS amount_paid,
       COALESCE(SUM(CASE WHEN sl.entry_type IN (${CREDIT_AVAILABLE_SQL}) THEN (${LEDGER_TERM_CREDIT_SQL}) ELSE 0 END), 0) AS credit,
       COALESCE(SUM(sl.debit), 0) - COALESCE(SUM(${LEDGER_TERM_CREDIT_SQL}), 0) AS net_balance
     FROM student_ledger sl
     JOIN terms t ON t.id = sl.term_id AND t.tenant_id = sl.tenant_id
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE sl.student_id = $1 AND sl.tenant_id = $2
     GROUP BY t.id, t.name, ay.name, ay.id
     ORDER BY ay.name ASC, t.name ASC`,
    [studentId, tenantId]
  );

  return res.rows.map((row) => {
    const feeBilled = roundMoney(parseFloat(row.fee_billed) || 0);
    const amountPaid = roundMoney(parseFloat(row.amount_paid) || 0);
    const credit = roundMoney(parseFloat(row.credit) || 0);
    const net = roundMoney(parseFloat(row.net_balance) || 0);
    const outstanding = roundMoney(Math.max(0, net));
    let status: TermLedgerSummaryRow['status'] = 'Paid';
    if (feeBilled <= 0 && amountPaid <= 0 && credit <= 0) {
      status = 'NotSet';
    } else if (net < -0.001) {
      status = 'Credit';
    } else if (net > 0.001) {
      status = 'Owing';
    }
    return {
      termId: Number(row.term_id),
      termLabel: String(row.term_label || '').trim(),
      feeBilled,
      amountPaid,
      outstanding,
      credit: net < -0.001 ? roundMoney(Math.max(credit, Math.abs(net))) : credit,
      status,
    };
  });
}

export type StudentBalanceApiShape = {
  currentTermFee: number;
  currentTermName: string | null;
  activeTermId: number | null;
  arrearLines: { termName: string; amount: number }[];
  totalArrears: number;
  creditBroughtForward: number;
  totalDue: number;
  paidLines: { termName: string; amount: number }[];
  totalPaid: number;
  outstanding: number;
  credit: number;
  netBalance: number;
  status: 'Owing' | 'Cleared' | 'Credit' | 'NotSet';
  termRows: Array<{
    termId: number | null;
    termName: string;
    termFee: number;
    amountPaid: number;
    outstanding: number;
    displayOutstanding: number;
    isActiveTerm: boolean;
  }>;
  paymentsMade: number;
  totalCharged: number;
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
  discountAmount?: number;
};

function deriveBalanceStatus(balance: LedgerBalance): StudentBalanceApiShape['status'] {
  if (
    balance.termFee <= 0 &&
    balance.individualCharges <= 0 &&
    balance.paymentsMade <= 0 &&
    balance.arrears <= 0 &&
    balance.creditFromCarryForward <= 0
  ) {
    return 'NotSet';
  }
  if (balance.netBalance < -0.001) return 'Credit';
  if (balance.netBalance > 0.001) return 'Owing';
  return 'Cleared';
}

/** Map master ledger balance to API shape used by frontend (current term only). */
export async function ledgerBalanceToApiShape(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId?: number | null
): Promise<StudentBalanceApiShape | null> {
  const { ledgerTermId, termLabel } = await resolveActiveLedgerTerm(
    client ? client.query.bind(client) : query,
    tenantId,
    termId ?? undefined
  );

  const effectiveTermId = termId ?? ledgerTermId;
  if (!effectiveTermId) {
    return {
      currentTermFee: 0,
      currentTermName: termLabel,
      activeTermId: null,
      arrearLines: [],
      totalArrears: 0,
      creditBroughtForward: 0,
      totalDue: 0,
      paidLines: [],
      totalPaid: 0,
      outstanding: 0,
      credit: 0,
      netBalance: 0,
      status: 'NotSet',
      termRows: [],
      paymentsMade: 0,
      totalCharged: 0,
      individualCharges: 0,
      individualChargeLines: [],
    };
  }

  const balance = await getStudentBalanceFromLedger(client, tenantId, studentId, effectiveTermId);
  const arrearsLines = await getArrearsBreakdownFromLedger(client, tenantId, studentId, effectiveTermId);
  const chargeRows = await listStudentCharges(tenantId, studentId, effectiveTermId);

  const arrearLines = arrearsLines.map((line) => ({
    termName: line.description,
    amount: line.amount,
  }));

  const individualChargeLines = chargeRows.map((c) => ({
    id: c.id,
    description: c.description,
    amount: c.amount,
    date: c.createdAt.split('T')[0],
    status: c.status,
    createdByName: c.createdByName,
    reason: c.reason,
  }));

  const status = deriveBalanceStatus(balance);
  const label = termLabel || 'Current term';

  const baseShape: StudentBalanceApiShape = {
    currentTermFee: balance.termFee,
    currentTermName: label,
    activeTermId: effectiveTermId,
    arrearLines,
    totalArrears: balance.arrears,
    creditBroughtForward: balance.creditFromCarryForward,
    totalDue: balance.totalDue,
    paidLines:
      balance.paymentsMade > 0
        ? [{ termName: `${label} (this term)`, amount: balance.paymentsMade }]
        : [],
    totalPaid: balance.paymentsMade,
    outstanding: balance.outstanding,
    credit: balance.creditBalance,
    netBalance: balance.netBalance,
    status,
    paymentsMade: balance.paymentsMade,
    totalCharged: balance.totalDue,
    individualCharges: balance.individualCharges,
    individualChargeLines,
    termRows: [
      {
        termId: effectiveTermId,
        termName: label,
        termFee: balance.termFee,
        amountPaid: balance.paymentsMade,
        outstanding: balance.outstanding,
        displayOutstanding: balance.outstanding,
        isActiveTerm: true,
      },
    ],
  };

  return enrichBalanceShapeWithExpectedFees(
    client,
    tenantId,
    studentId,
    effectiveTermId,
    baseShape
  );
}
