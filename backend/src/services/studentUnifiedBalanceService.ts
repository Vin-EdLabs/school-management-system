import type pg from 'pg';
import { query } from '../db/connection.js';
import { resolveLedgerTermFromSettings } from './ledgerFinanceService.js';
import {
  getStudentBalanceFromLedger,
  getArrearsBreakdownFromLedger,
} from './ledgerBalanceService.js';
import { resolveLedgerFeeStructureForStudent } from './effectiveStudentBalanceService.js';

type QueryFn = typeof query;

/** Entry types excluded from effective balance calculations (prevent double-counting). */
export const CARRY_FORWARD_ENTRY_TYPES = [
  'carry_forward_credit',
  'carry_forward_debit',
  'credit_brought_forward',
] as const;

/** Arrears debits are consolidations — exclude from carry-forward outstanding sums. */
export const ARREARS_EXCLUDED_DEBIT_TYPES = [
  'arrears',
  ...CARRY_FORWARD_ENTRY_TYPES,
] as const;

/** Debits that receive carry_forward_credit when closing a term. */
export const BILLABLE_DEBIT_TYPES = ['term_fee', 'payment_correction', 'manual_adjustment', 'student_charge'] as const;

const cfList = CARRY_FORWARD_ENTRY_TYPES.map((t) => `'${t}'`).join(', ');
const arrearsExcludedList = ARREARS_EXCLUDED_DEBIT_TYPES.map((t) => `'${t}'`).join(', ');
const billableDebitList = BILLABLE_DEBIT_TYPES.map((t) => `'${t}'`).join(', ');

/** Billable debits minus real payments (excludes carry-forward closing credits). */
export const SQL_EFFECTIVE_CREDIT = `COALESCE(SUM(CASE WHEN sl.entry_type NOT IN (${cfList}) THEN sl.credit ELSE 0 END), 0)`;

/** Debits counted toward true outstanding (excludes arrears + carry-forward meta entries). */
export const SQL_TRUE_OUTSTANDING_DEBIT = `COALESCE(SUM(CASE WHEN sl.entry_type NOT IN (${arrearsExcludedList}) THEN sl.debit ELSE 0 END), 0)`;

/** term_fee / adjustment debits only — used when posting carry_forward_credit. */
export const SQL_BILLABLE_DEBIT = `COALESCE(SUM(CASE WHEN sl.entry_type IN (${billableDebitList}) THEN sl.debit ELSE 0 END), 0)`;

export const SQL_TRUE_OUTSTANDING = `${SQL_TRUE_OUTSTANDING_DEBIT} - ${SQL_EFFECTIVE_CREDIT}`;

export const SQL_BILLABLE_TERM_BALANCE = `${SQL_BILLABLE_DEBIT} - ${SQL_EFFECTIVE_CREDIT}`;

export type BalanceStatus = 'Owing' | 'Cleared' | 'Credit' | 'NotSet';

export type LedgerEntry = {
  id: number;
  entryType: string;
  description: string;
  debit: number;
  credit: number;
  reference: string | null;
  paymentId: number | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type StudentTermBalance = {
  termId: number;
  termName: string;
  academicYear: string;
  termFee: number;
  arrearsBroughtForward: number;
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  credit: number;
  status: BalanceStatus;
  isCurrentTerm: boolean;
  entries: LedgerEntry[];
};

export type StudentFullBalance = {
  currentTerm: StudentTermBalance | null;
  priorTerms: StudentTermBalance[];
  arrearLines: { termName: string; amount: number }[];
  totalArrears: number;
  creditBroughtForward: number;
  totalDue: number;
  totalPaid: number;
  lifetimePaid: number;
  outstanding: number;
  credit: number;
  netBalance: number;
  status: BalanceStatus;
  termRows: StudentTermBalance[];
};

export type PaymentAllocation = {
  termFee: number;
  arrears: number;
  totalDue: number;
  totalPaidBefore: number;
  outstandingBefore: number;
  amountPaid: number;
  arrearsCleared: number;
  termFeeCleared: number;
  outstandingAfter: number;
  credit: number;
  status: BalanceStatus;
};

export type ReceiptSnapshot = {
  termFee: number;
  arrears: number;
  totalDue: number;
  amountPaid: number;
  arrearsCleared: number;
  termFeeCleared: number;
  outstandingBefore: number;
  outstandingAfter: number;
  totalPaidThisTerm?: number;
  status: BalanceStatus;
  credit: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Prior-term unpaid = that term's fee minus payments in that term only (excludes carry-forward arrears debits). */
export function computeTermOwnOutstanding(termFee: number, amountPaidInTerm: number): number {
  return roundMoney(Math.max(0, termFee - amountPaidInTerm));
}

function deriveStatus(outstanding: number, credit: number): BalanceStatus {
  if (credit > 0.001) return 'Credit';
  if (outstanding > 0.001) return 'Owing';
  return 'Cleared';
}

export async function resolveActiveLedgerTerm(
  run: QueryFn,
  tenantId: number,
  activeTermId?: number | null
): Promise<{ ledgerTermId: number | null; academicYearId: number | null; termLabel: string | null }> {
  if (activeTermId != null && !Number.isNaN(Number(activeTermId))) {
    const academicRes = await run(
      `SELECT id, term_name, year FROM academic_terms WHERE id = $1 AND tenant_id = $2`,
      [activeTermId, tenantId]
    );
    if (academicRes.rows.length > 0) {
      const row = academicRes.rows[0];
      const resolved = await resolveLedgerTermFromSettings(tenantId, String(row.year), String(row.term_name));
      return {
        ledgerTermId: resolved?.termId ?? null,
        academicYearId: resolved?.academicYearId ?? null,
        termLabel: `${row.term_name} ${row.year}`.trim(),
      };
    }

    const ledgerRes = await run(
      `SELECT t.id, t.academic_year_id, t.name, ay.name AS year_name
       FROM terms t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [activeTermId, tenantId]
    );
    if (ledgerRes.rows.length > 0) {
      const row = ledgerRes.rows[0];
      return {
        ledgerTermId: Number(row.id),
        academicYearId: Number(row.academic_year_id),
        termLabel: `${row.name} ${row.year_name}`.trim(),
      };
    }
  }

  const settingsRes = await run(
    `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const currentTerm = settingsRes.rows[0]?.current_term;
  const currentYear = settingsRes.rows[0]?.current_year;
  if (!currentTerm || !currentYear) {
    return { ledgerTermId: null, academicYearId: null, termLabel: null };
  }
  const resolved = await resolveLedgerTermFromSettings(tenantId, String(currentYear), String(currentTerm));
  return {
    ledgerTermId: resolved?.termId ?? null,
    academicYearId: resolved?.academicYearId ?? null,
    termLabel: `${currentTerm} ${currentYear}`.trim(),
  };
}

async function fetchTermAggregates(
  run: QueryFn,
  tenantId: number,
  studentId: number
): Promise<
  Array<{
    termId: number;
    termName: string;
    academicYear: string;
    termFee: number;
    arrearsBroughtForward: number;
    totalPaid: number;
    totalDebit: number;
    outstanding: number;
  }>
> {
  const res = await run(
    `SELECT sl.term_id,
            t.name AS term_part,
            ay.name AS year_part,
            COALESCE(SUM(CASE WHEN sl.entry_type = 'term_fee' THEN sl.debit ELSE 0 END), 0)::numeric AS term_fee,
            COALESCE(SUM(CASE WHEN sl.entry_type = 'arrears' THEN sl.debit ELSE 0 END), 0)::numeric AS arrears_bf,
            COALESCE(SUM(CASE WHEN sl.entry_type NOT IN (${cfList}) THEN sl.credit ELSE 0 END), 0)::numeric AS total_paid,
            COALESCE(SUM(CASE WHEN sl.entry_type NOT IN (${cfList}) THEN sl.debit ELSE 0 END), 0)::numeric AS total_debit,
            COALESCE(SUM(CASE WHEN sl.entry_type NOT IN (${cfList}) THEN sl.debit ELSE 0 END), 0)::numeric
              - COALESCE(SUM(CASE WHEN sl.entry_type NOT IN (${cfList}) THEN sl.credit ELSE 0 END), 0)::numeric AS outstanding_raw
     FROM student_ledger sl
     JOIN terms t ON t.id = sl.term_id
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE sl.tenant_id = $1 AND sl.student_id = $2 AND sl.term_id IS NOT NULL
     GROUP BY sl.term_id, t.name, ay.name, ay.id, t.id
     HAVING COALESCE(SUM(sl.debit), 0) > 0 OR COALESCE(SUM(sl.credit), 0) > 0
     ORDER BY ay.name ASC, t.name ASC`,
    [tenantId, studentId]
  );

  return res.rows.map((row) => {
    const outstandingRaw = parseFloat(row.outstanding_raw) || 0;
    return {
      termId: Number(row.term_id),
      termName: `${row.term_part} ${row.year_part}`.trim(),
      academicYear: String(row.year_part),
      termFee: roundMoney(parseFloat(row.term_fee) || 0),
      arrearsBroughtForward: roundMoney(parseFloat(row.arrears_bf) || 0),
      totalPaid: roundMoney(parseFloat(row.total_paid) || 0),
      totalDebit: roundMoney(parseFloat(row.total_debit) || 0),
      outstanding: roundMoney(Math.max(0, outstandingRaw)),
      credit: roundMoney(Math.max(0, -outstandingRaw)),
    } as any;
  });
}

async function fetchTermEntries(
  run: QueryFn,
  tenantId: number,
  studentId: number,
  termId: number
): Promise<LedgerEntry[]> {
  const res = await run(
    `SELECT id, entry_type, description, debit, credit, reference, payment_id, created_at, metadata
     FROM student_ledger
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
     ORDER BY created_at ASC, id ASC`,
    [tenantId, studentId, termId]
  );
  return res.rows.map((r) => ({
    id: Number(r.id),
    entryType: String(r.entry_type || ''),
    description: String(r.description || ''),
    debit: roundMoney(parseFloat(r.debit) || 0),
    credit: roundMoney(parseFloat(r.credit) || 0),
    reference: r.reference ? String(r.reference) : null,
    paymentId: r.payment_id != null ? Number(r.payment_id) : null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    metadata: (r.metadata && typeof r.metadata === 'object' ? r.metadata : {}) as Record<string, unknown>,
  }));
}

function buildTermBalance(
  agg: {
    termId: number;
    termName: string;
    academicYear: string;
    termFee: number;
    arrearsBroughtForward: number;
    totalPaid: number;
    totalDebit: number;
    outstanding: number;
    credit?: number;
  },
  isCurrentTerm: boolean,
  entries: LedgerEntry[]
): StudentTermBalance {
  const creditAmt = roundMoney(agg.credit ?? Math.max(0, agg.totalPaid - agg.termFee - agg.arrearsBroughtForward));
  const totalDue = roundMoney(agg.termFee + agg.arrearsBroughtForward);
  const outstanding =
    agg.totalPaid > totalDue + 0.001
      ? 0
      : roundMoney(Math.max(0, totalDue - agg.totalPaid));
  const credit =
    agg.totalPaid > totalDue + 0.001 ? roundMoney(agg.totalPaid - totalDue) : creditAmt > 0 ? creditAmt : 0;

  const noTermFeePosted = isCurrentTerm && agg.termFee <= 0 && agg.totalPaid <= 0;
  const status: BalanceStatus = noTermFeePosted ? 'NotSet' : deriveStatus(outstanding, credit);

  return {
    termId: agg.termId,
    termName: agg.termName,
    academicYear: agg.academicYear,
    termFee: agg.termFee,
    arrearsBroughtForward: agg.arrearsBroughtForward,
    totalDue,
    totalPaid: agg.totalPaid,
    outstanding,
    credit,
    status,
    isCurrentTerm,
    entries,
  };
}

function buildSyntheticCurrentTerm(
  ledgerTermId: number,
  termLabel: string | null
): StudentTermBalance {
  const termName = termLabel || 'Current term';
  return {
    termId: ledgerTermId,
    termName,
    academicYear: '',
    termFee: 0,
    arrearsBroughtForward: 0,
    totalDue: 0,
    totalPaid: 0,
    outstanding: 0,
    credit: 0,
    status: 'NotSet',
    isCurrentTerm: true,
    entries: [],
  };
}

/**
 * Full balance view — delegates to getStudentBalanceFromLedger for the active term.
 */
export async function getStudentFullBalance(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  activeTermId?: number | null
): Promise<StudentFullBalance | null> {
  const run: QueryFn = client ? client.query.bind(client) : query;

  const studentRes = await run(`SELECT id FROM students WHERE id = $1 AND tenant_id = $2`, [studentId, tenantId]);
  if (studentRes.rows.length === 0) return null;

  const { ledgerTermId, termLabel } = await resolveActiveLedgerTerm(run, tenantId, activeTermId);

  if (ledgerTermId == null) {
    return {
      currentTerm: null,
      priorTerms: [],
      arrearLines: [],
      totalArrears: 0,
      creditBroughtForward: 0,
      totalDue: 0,
      totalPaid: 0,
      lifetimePaid: 0,
      outstanding: 0,
      credit: 0,
      netBalance: 0,
      status: 'NotSet',
      termRows: [],
    };
  }

  const balance = await getStudentBalanceFromLedger(client, tenantId, studentId, ledgerTermId);
  const arrearsLines = await getArrearsBreakdownFromLedger(client, tenantId, studentId, ledgerTermId);
  const arrearLines = arrearsLines.map((line) => ({
    termName: line.description,
    amount: line.amount,
  }));

  let status: BalanceStatus = 'Cleared';
  if (balance.termFee <= 0 && balance.paymentsMade <= 0 && balance.arrears <= 0 && balance.creditFromCarryForward <= 0) {
    status = 'NotSet';
  } else if (balance.netBalance < -0.001) {
    status = 'Credit';
  } else if (balance.netBalance > 0.001) {
    status = 'Owing';
  }

  const label = termLabel || 'Current term';
  const currentTerm: StudentTermBalance = {
    termId: ledgerTermId,
    termName: label,
    academicYear: '',
    termFee: balance.termFee,
    arrearsBroughtForward: balance.arrears,
    totalDue: balance.totalDue,
    totalPaid: balance.paymentsMade,
    outstanding: balance.outstanding,
    credit: balance.creditBalance,
    status,
    isCurrentTerm: true,
    entries: [],
  };

  return {
    currentTerm,
    priorTerms: [],
    arrearLines,
    totalArrears: balance.arrears,
    creditBroughtForward: balance.creditFromCarryForward,
    totalDue: balance.totalDue,
    totalPaid: balance.paymentsMade,
    lifetimePaid: balance.paymentsMade,
    outstanding: balance.outstanding,
    credit: balance.creditBalance,
    netBalance: balance.netBalance,
    status,
    termRows: [currentTerm],
  };
}

/** Payment allocation context for the current active term — ledger-only. */
export async function getCurrentTermPaymentContext(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number
): Promise<{
  ledgerTermId: number;
  academicYearId: number;
  termLabel: string;
  termFee: number;
  arrears: number;
  totalDue: number;
  totalPaid: number;
  outstandingBefore: number;
  creditBroughtForward: number;
} | null> {
  const run: QueryFn = client ? client.query.bind(client) : query;
  const { ledgerTermId, academicYearId, termLabel } = await resolveActiveLedgerTerm(run, tenantId);
  if (!ledgerTermId || !academicYearId || !termLabel) return null;

  const balance = await getStudentBalanceFromLedger(client, tenantId, studentId, ledgerTermId);

  let termFee = balance.termFee;
  let totalDue = balance.totalDue;
  let outstandingBefore = balance.outstanding;

  if (termFee <= 0) {
    const resolved = await resolveLedgerFeeStructureForStudent(client, tenantId, studentId, ledgerTermId);
    if (resolved) {
      termFee = resolved.netTotal;
      totalDue = roundMoney(termFee + balance.arrears + (balance.individualCharges ?? 0));
      outstandingBefore = roundMoney(
        Math.max(0, totalDue - balance.paymentsMade - balance.creditFromCarryForward)
      );
    }
  }

  return {
    ledgerTermId,
    academicYearId,
    termLabel,
    termFee,
    arrears: balance.arrears,
    totalDue,
    totalPaid: balance.paymentsMade,
    outstandingBefore,
    creditBroughtForward: balance.creditFromCarryForward,
  };
}

/** Arrears-first payment allocation (pure). Uses ledger net outstanding when provided. */
export function allocatePayment(
  ctx: {
    termFee: number;
    arrears: number;
    totalDue: number;
    totalPaid: number;
    outstandingBefore?: number;
  },
  paymentAmount: number
): PaymentAllocation {
  const termFee = roundMoney(ctx.termFee);
  const arrears = roundMoney(ctx.arrears);
  const totalDue = roundMoney(ctx.totalDue);
  const totalPaidBefore = roundMoney(ctx.totalPaid);
  const outstandingBefore =
    ctx.outstandingBefore != null
      ? roundMoney(Math.max(0, ctx.outstandingBefore))
      : roundMoney(Math.max(0, totalDue - totalPaidBefore));

  const arrearsClearedSoFar = Math.min(arrears, totalPaidBefore);
  const arrearsRemaining = roundMoney(Math.max(0, arrears - arrearsClearedSoFar));

  let arrearsCleared = 0;
  let termFeeCleared = 0;
  if (paymentAmount <= arrearsRemaining + 0.001) {
    arrearsCleared = roundMoney(paymentAmount);
  } else {
    arrearsCleared = arrearsRemaining;
    termFeeCleared = roundMoney(paymentAmount - arrearsRemaining);
  }

  const outstandingAfter = roundMoney(outstandingBefore - paymentAmount);
  let credit = 0;
  let status: BalanceStatus = 'Cleared';
  if (outstandingAfter > 0.001) {
    status = 'Owing';
  } else if (outstandingAfter < -0.001) {
    credit = roundMoney(Math.abs(outstandingAfter));
    status = 'Credit';
  }

  return {
    termFee,
    arrears,
    totalDue,
    totalPaidBefore,
    outstandingBefore,
    amountPaid: roundMoney(paymentAmount),
    arrearsCleared,
    termFeeCleared,
    outstandingAfter: roundMoney(Math.max(0, outstandingAfter)),
    credit,
    status,
  };
}

export function buildReceiptSnapshot(allocation: PaymentAllocation): ReceiptSnapshot {
  return {
    termFee: allocation.termFee,
    arrears: allocation.arrears,
    totalDue: allocation.totalDue,
    amountPaid: allocation.amountPaid,
    arrearsCleared: allocation.arrearsCleared,
    termFeeCleared: allocation.termFeeCleared,
    outstandingBefore: allocation.outstandingBefore,
    outstandingAfter: allocation.outstandingAfter,
    totalPaidThisTerm: roundMoney(allocation.totalPaidBefore + allocation.amountPaid),
    status: allocation.status,
    credit: allocation.credit,
  };
}

/** Map to legacy live-breakdown shape for existing API consumers. */
export function fullBalanceToLiveBreakdown(
  balance: StudentFullBalance,
  activeTermId: number | null
): import('./studentLiveFeeBreakdownService.js').StudentLiveFeeBreakdown {
  const ct = balance.currentTerm;
  return {
    currentTermFee: ct?.termFee ?? 0,
    currentTermName: ct?.termName ?? null,
    activeTermId,
    arrearLines: balance.arrearLines,
    totalArrears: balance.totalArrears,
    creditBroughtForward: balance.creditBroughtForward,
    totalDue: balance.totalDue,
    paidLines: ct && ct.totalPaid > 0 ? [{ termName: ct.termName, amount: ct.totalPaid }] : [],
    totalPaid: balance.totalPaid,
    outstanding: balance.outstanding,
    credit: balance.credit,
    netBalance: balance.netBalance,
    status: balance.status === 'NotSet' ? 'Cleared' : balance.status,
    paymentsMade: balance.currentTerm ? balance.totalPaid : 0,
    totalCharged: balance.totalDue,
    individualCharges: 0,
    individualChargeLines: [],
    termRows: balance.termRows.map((r) => {
      const displayOutstanding = r.isCurrentTerm
        ? r.outstanding
        : computeTermOwnOutstanding(r.termFee, r.totalPaid);
      return {
        termId: r.termId,
        termName: r.termName,
        termFee: r.termFee,
        amountPaid: r.totalPaid,
        outstanding: displayOutstanding,
        displayOutstanding,
        isActiveTerm: r.isCurrentTerm,
      };
    }),
  };
}

export function liveBreakdownToSummary(balance: StudentFullBalance | ReturnType<typeof fullBalanceToLiveBreakdown>) {
  if ('termRows' in balance && 'currentTerm' in balance) {
    const b = balance as StudentFullBalance;
    return {
      termFee: b.currentTerm?.termFee ?? 0,
      arrears: b.totalArrears,
      totalDue: b.totalDue,
      totalPaid: b.totalPaid,
      outstanding: b.outstanding,
      credit: b.credit,
      status: b.status,
    };
  }
  const lb = balance as import('./studentLiveFeeBreakdownService.js').StudentLiveFeeBreakdown;
  return {
    termFee: lb.currentTermFee,
    arrears: lb.totalArrears,
    totalDue: lb.totalDue,
    totalPaid: lb.totalPaid,
    outstanding: lb.outstanding,
    credit: lb.credit,
    status: lb.status,
  };
}
