import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  getCashPosition,
  getCollectionsByAccount,
  getDirectActivityTotals,
  getFundTransfersReport,
  getIncomeAndExpenseTotalsAll,
  getIncomeAndExpenseTotalsInRange,
  getFeesCollectedAll,
  getFeesCollectedForTerm,
  buildAccountSnapshots,
  getTotalOpeningBalance,
} from '../services/financeSummaryService.js';
import { ACTIVE_STUDENT_WHERE } from '../utils/studentEnrollment.js';
import { TEACHER_COUNTABLE_WHERE, OTHER_STAFF_COUNTABLE_WHERE, TEACHER_VISIBLE_WHERE, TEACHER_PAYROLL_WHERE } from '../constants/staffQueries.js';
import { getStudentLiveFeeBreakdown } from '../services/studentLiveFeeBreakdownService.js';
import { ensureTenantLedgerSynced } from '../services/ledgerBackfillService.js';
import { SQL_EFFECTIVE_STUDENT_LEDGER_TOTALS_CTE } from '../utils/feeStructureSql.js';
import { getOutstandingFeesFromLedger } from '../services/ledgerBalanceService.js';
import { recalculateTermOutstandingBalances } from '../services/ledgerFinanceService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

/**
 * Resolve term string for matching fee_structures and payments.
 * fee_structures.term and payments.term may be "Term 1" or "Term 1 2024".
 * Avoid double-appending year if term already ends with it.
 */
function resolveTermMatch(term: string | null, academicYear: string | null): string | null {
  if (!term) return null;
  const t = String(term).trim();
  if (!academicYear) return t;
  const y = String(academicYear).trim();
  if (!y || t.endsWith(y)) return t;
  return `${t} ${y}`;
}

/** Fee structure / payments / arrears term matching ($1 tenant; $2 termMatch; $3 termLike; $4 termOnly). */
const TERM_PRED_FS = `
  (
    TRIM(COALESCE(fs.term, '')) = ''
    OR fs.term = $2 OR fs.term = $4 OR fs.term LIKE $3
    OR $2 LIKE TRIM(fs.term) || '%' OR TRIM(fs.term) LIKE $2 || '%'
    OR $4 LIKE TRIM(fs.term) || '%' OR TRIM(fs.term) LIKE $4 || '%'
  )`;
/** Fee structure / payments / arrears term matching — param indices are 1-based ($n). */
function termPredPay(alias: string, termMatchIdx: number, termLikeIdx: number, termOnlyIdx: number): string {
  const p = `${alias}.`;
  const m = `$${termMatchIdx}`;
  const l = `$${termLikeIdx}`;
  const o = `$${termOnlyIdx}`;
  return `
  (
    TRIM(COALESCE(${p}term, '')) = ''
    OR ${p}term = ${m} OR ${p}term = ${o} OR ${p}term LIKE ${l}
    OR ${m} LIKE TRIM(${p}term) || '%' OR TRIM(${p}term) LIKE ${m} || '%'
    OR ${o} LIKE TRIM(${p}term) || '%' OR TRIM(${p}term) LIKE ${o} || '%'
  )`;
}

/** Default payment term match when $2=termMatch, $3=termLike, $4=termOnly (tenant is $1). */
const TERM_PRED_PAY = termPredPay('p', 2, 3, 4);
const TERM_PRED_TA = `
  (
    TRIM(COALESCE(ta.current_term, '')) = ''
    OR ta.current_term = $2 OR ta.current_term = $4 OR ta.current_term LIKE $3
    OR $2 LIKE TRIM(ta.current_term) || '%' OR TRIM(ta.current_term) LIKE $2 || '%'
    OR $4 LIKE TRIM(ta.current_term) || '%' OR TRIM(ta.current_term) LIKE $4 || '%'
  )`;

const DISCOUNTED_TERM_FEE_SQL = `
  (
    CASE
      WHEN s.is_beneficiary = true AND LOWER(TRIM(COALESCE(s.discount_type::text, ''))) = 'percentage'
        THEN COALESCE(crf.raw_total, 0) - (COALESCE(crf.raw_total, 0) * COALESCE(s.discount_value, 0) / 100)
      WHEN s.is_beneficiary = true AND LOWER(TRIM(COALESCE(s.discount_type::text, ''))) = 'fixed'
        THEN GREATEST(0::numeric, COALESCE(crf.raw_total, 0) - COALESCE(s.discount_value, 0))
      ELSE COALESCE(crf.raw_total, 0)
    END
  )`;

/** Display label e.g. "2026" -> "2026/2027"; keeps "2026/2027" normalized. */
function formatAcademicYearLabel(raw: string | null | undefined): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const slash = s.match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (slash) return `${slash[1]}/${slash[2]}`;
  const one = s.match(/^(\d{4})$/);
  if (one) {
    const y = parseInt(one[1], 10);
    return `${y}/${y + 1}`;
  }
  const lead = s.match(/^(\d{4})/);
  if (lead) {
    const y = parseInt(lead[1], 10);
    return `${y}/${y + 1}`;
  }
  return s;
}

/** Default Sept–Aug academic window when settings rows have no dates. */
function inferBoundsFromYearKey(key: string): { from: string; to: string } {
  const s = key.trim();
  const slash = s.match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (slash) {
    const y1 = parseInt(slash[1], 10);
    const y2 = parseInt(slash[2], 10);
    return { from: `${y1}-09-01`, to: `${y2}-08-31` };
  }
  const one = s.match(/^(\d{4})$/);
  if (one) {
    const y = parseInt(one[1], 10);
    return { from: `${y}-09-01`, to: `${y + 1}-08-31` };
  }
  const y = new Date().getFullYear();
  return { from: `${y}-09-01`, to: `${y + 1}-08-31` };
}

async function resolveFinanceBounds(tenantId: number, academicYearKey: string): Promise<{ from: string; to: string }> {
  const key = String(academicYearKey || '').trim();
  if (!key) return inferBoundsFromYearKey(String(new Date().getFullYear()));
  try {
    const r = await query(
      `SELECT MIN(start_date)::text AS d0, MAX(end_date)::text AS d1
       FROM academic_terms
       WHERE tenant_id = $1 AND year = $2
         AND start_date IS NOT NULL AND end_date IS NOT NULL`,
      [tenantId, key]
    );
    const row = r.rows[0];
    const d0 = row?.d0 ? String(row.d0).split('T')[0] : null;
    const d1 = row?.d1 ? String(row.d1).split('T')[0] : null;
    if (d0 && d1) return { from: d0, to: d1 };
  } catch {
    /* use inference */
  }
  return inferBoundsFromYearKey(key);
}

/** Prefer ledger term start/end dates for term-scoped finance reports. */
async function resolveLedgerTermDateBounds(
  tenantId: number,
  ledgerTermId: number | null,
  fallback: { from: string; to: string }
): Promise<{ from: string; to: string }> {
  if (ledgerTermId == null) return fallback;
  try {
    const r = await query(
      `SELECT start_date::text AS d0, end_date::text AS d1
       FROM terms
       WHERE id = $1 AND tenant_id = $2
       LIMIT 1`,
      [ledgerTermId, tenantId]
    );
    const d0 = r.rows[0]?.d0 ? String(r.rows[0].d0).split('T')[0] : null;
    const d1 = r.rows[0]?.d1 ? String(r.rows[0].d1).split('T')[0] : null;
    if (d0 && d1) return { from: d0, to: d1 };
  } catch {
    /* fallback */
  }
  return fallback;
}

type ReportPeriod = {
  tenantId: number;
  term: string;
  academicYear: string;
  termMatch: string;
  termLike: string;
  termOnly: string;
  financeFrom: string;
  financeTo: string;
  academicYearDisplay: string;
  ledgerTermId: number | null;
};

/** Per-student ledger totals for the report term (term_fee, arrears, paid, outstanding) with fee-structure fallback. */
const LEDGER_STUDENT_TOTALS_CTE = SQL_EFFECTIVE_STUDENT_LEDGER_TOTALS_CTE;

/** Exclude daily-fee class students from term fee dashboard metrics. */
const TERM_FEE_STUDENT_CLASS_FILTER = `(c.id IS NULL OR COALESCE(c.fee_mode, 'term') != 'daily')`;

async function loadReportPeriod(req: AuthRequest): Promise<ReportPeriod> {
  const tenantId = req.user!.tenantId!;

  const {
    resolveActiveLedgerTerm,
    resolveLedgerTermById,
    resolveLedgerTermByLabel,
  } = await import('../services/studentUnifiedBalanceService.js');

  const rawTermId = req.query.termId ?? req.query.term_id;
  const requestedTermId =
    rawTermId != null && String(rawTermId).trim() !== ''
      ? parseInt(String(rawTermId), 10)
      : null;
  const hasExplicitTermId =
    requestedTermId != null && !Number.isNaN(requestedTermId);

  let termRaw = ((req.query.term as string) || '').trim();
  const yearRaw = ((req.query.year as string) || '').trim();
  if (termRaw && /^\d+$/.test(termRaw)) {
    termRaw = `Term ${termRaw}`;
  }
  const hasTermOrYearQuery = !!(termRaw || yearRaw);

  const settingsResult = await query(
    'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1',
    [tenantId]
  );

  let resolvedLedger: {
    ledgerTermId: number | null;
    academicYearId: number | null;
    termLabel: string | null;
  };

  if (hasExplicitTermId) {
    resolvedLedger = await resolveLedgerTermById(query, tenantId, requestedTermId!);
  } else if (hasTermOrYearQuery) {
    const yearHint = yearRaw || String(settingsResult.rows[0]?.current_year || '').trim();
    const termHint =
      termRaw ||
      String(settingsResult.rows[0]?.current_term || '').trim() ||
      'Term 1';
    const byLabel = await resolveLedgerTermByLabel(query, tenantId, termHint, yearHint);
    resolvedLedger =
      byLabel.ledgerTermId != null
        ? byLabel
        : await resolveActiveLedgerTerm(query, tenantId);
  } else {
    resolvedLedger = await resolveActiveLedgerTerm(query, tenantId);
  }

  const ledgerTermId = resolvedLedger.ledgerTermId ?? null;

  const defaultTerm = (resolvedLedger.termLabel || settingsResult.rows[0]?.current_term || 'Term 1')
    .toString()
    .trim();
  const yearFromLabel =
    resolvedLedger.termLabel?.match(/\b(20\d{2}(?:\/\d{2,4})?)\b/)?.[1] ?? null;
  const defaultYear = String(
    yearRaw ||
      yearFromLabel ||
      settingsResult.rows[0]?.current_year ||
      new Date().getFullYear()
  ).trim();

  const term = termRaw || defaultTerm;
  const academicYear = yearRaw || defaultYear;

  const termMatch = resolveTermMatch(term, academicYear) || term;
  const termLike = `${termMatch}%`;
  const termStr = String(term).trim();
  const termOnly = termStr.replace(/\s+\d{4}$/, '').trim() || termStr;

  const { from: financeFrom, to: financeTo } = await resolveFinanceBounds(tenantId, academicYear);
  const academicYearDisplay = formatAcademicYearLabel(academicYear);

  return { tenantId, term, academicYear, termMatch, termLike, termOnly, financeFrom, financeTo, academicYearDisplay, ledgerTermId };
}

/**
 * GET /api/reports/fee-status
 * Fee Status / Class Report: all students in a class for an academic period.
 * Uses live student_ledger breakdown (same as records / balance card). Does not read term_arrears.
 *
 * Query params:
 *   classId (required) - class id
 *   academicPeriodId - optional; if not provided, current period from school_settings is used
 *   term - optional; used with academicYear when academicPeriodId not used
 *   academicYear - optional
 *   status - 'all' | 'owing' | 'paid' (default: all)
 *
 * Response: students include termFee, arrears, totalFeeExpected (term+arrears), totalPaid, balance; summary includes totalTermFee, totalArrears, totalExpected, totalPaid, totalBalance.
 */
router.get('/fee-status', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;

    await ensureTenantLedgerSynced(tenantId);

    const { classId, academicPeriodId, term: queryTerm, academicYear: queryYear, status = 'all' } = req.query;

    if (!classId) {
      return res.status(400).json({ error: 'classId is required' });
    }

    const classIdNum = parseInt(String(classId), 10);
    if (Number.isNaN(classIdNum)) {
      return res.status(400).json({ error: 'Invalid classId' });
    }

    let term: string;
    let academicYear: string;

    if (academicPeriodId) {
      const periodResult = await query(
        'SELECT term_name, year FROM academic_terms WHERE id = $1 AND tenant_id = $2',
        [academicPeriodId, tenantId]
      );
      if (periodResult.rows.length === 0) {
        return res.status(404).json({ error: 'Academic period not found' });
      }
      term = periodResult.rows[0].term_name;
      academicYear = periodResult.rows[0].year;
    } else {
      const settingsResult = await query(
        'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1',
        [tenantId]
      );
      if (settingsResult.rows.length === 0) {
        return res.status(400).json({ error: 'School settings not found. Set current term and year.' });
      }
      term = (queryTerm as string) || settingsResult.rows[0].current_term || '';
      academicYear = (queryYear as string) || settingsResult.rows[0].current_year || '';
    }

    if (!term || !academicYear) {
      return res.status(400).json({ error: 'Academic period could not be resolved. Set current term and year in settings.' });
    }

    const activeTermId = academicPeriodId
      ? parseInt(String(academicPeriodId), 10)
      : (await query(
          `SELECT id FROM academic_terms WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
          [tenantId]
        )).rows[0]?.id ?? null;

    const studentsRes = await query(
      `SELECT s.id, s.student_id, s.first_name, s.last_name, c.class_name
       FROM students s
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       WHERE s.tenant_id = $1 AND s.class_assigned_id = $2 AND ${ACTIVE_STUDENT_WHERE}
       ORDER BY s.first_name, s.last_name`,
      [tenantId, classIdNum]
    );

    let students = await Promise.all(
      studentsRes.rows.map(async (row: any) => {
        const breakdown = await getStudentLiveFeeBreakdown(
          null,
          tenantId,
          row.id,
          activeTermId
        );
        const b = breakdown ?? {
          currentTermFee: 0,
          totalArrears: 0,
          totalDue: 0,
          totalPaid: 0,
          outstanding: 0,
          credit: 0,
          status: 'NotSet' as const,
          arrearLines: [],
          paidLines: [],
          termRows: [],
        };
        const balance = b.status === 'NotSet' ? 0 : b.outstanding > 0 ? b.outstanding : b.credit > 0 ? -b.credit : 0;
        return {
          studentId: row.id,
          studentNumber: row.student_id,
          studentName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
          className: row.class_name || '',
          termFee: b.currentTermFee,
          arrears: b.totalArrears,
          totalFeeExpected: b.totalDue,
          totalPaid: b.totalPaid,
          balance,
          status:
            b.status === 'NotSet'
              ? 'not_set'
              : b.outstanding > 0
                ? 'owing'
                : b.credit > 0
                  ? 'credit'
                  : b.currentTermFee <= 0 && b.totalDue <= 0
                    ? 'no_fee'
                    : 'paid',
          liveBreakdown: breakdown,
        };
      })
    );

    const statusFilter = (status as string).toLowerCase();
    if (statusFilter === 'owing') {
      students = students.filter((s) => s.balance > 0);
    } else if (statusFilter === 'paid') {
      students = students.filter((s) => s.balance <= 0);
    }

    const totalTermFee = students.reduce((sum: number, s: any) => sum + s.termFee, 0);
    const totalArrearsSum = students.reduce((sum: number, s: any) => sum + s.arrears, 0);
    const totalExpected = students.reduce((sum: number, s: any) => sum + s.totalFeeExpected, 0);
    const totalPaid = students.reduce((sum: number, s: any) => sum + s.totalPaid, 0);
    const totalBalance = students.reduce(
      (sum: number, s: any) => sum + (s.balance > 0 ? s.balance : 0),
      0
    );

    const classResult = await query(
      'SELECT id, class_name FROM classes WHERE id = $1 AND tenant_id = $2',
      [classIdNum, tenantId]
    );
    const classRow = classResult.rows[0];

    res.json({
      academicPeriod: {
        term,
        academicYear,
        label: `${term} ${academicYear}`.trim(),
      },
      class: {
        id: classIdNum,
        name: classRow?.class_name || '',
      },
      students,
      summary: {
        totalTermFee,
        totalArrears: totalArrearsSum,
        totalExpected,
        totalPaid,
        totalBalance,
        count: students.length,
      },
    });
  } catch (error) {
    console.error('Fee status report error:', error);
    res.status(500).json({ error: 'Failed to generate fee status report' });
  }
});

/**
 * GET /api/reports/financial-summary
 * Term activity (fees / income / expenses) is scoped to the selected term.
 * systemNetPosition is the school-wide carried total (all terms combined).
 */
router.get('/financial-summary', async (req: AuthRequest, res) => {
  try {
    const { tenantId, term, termMatch, termLike, termOnly, financeFrom, financeTo, academicYearDisplay, academicYear, ledgerTermId } =
      await loadReportPeriod(req);

    try {
      await ensureTenantLedgerSynced(tenantId);
    } catch (syncErr) {
      console.error('[financial-summary] Ledger sync failed (continuing):', syncErr);
    }

    const termBounds = await resolveLedgerTermDateBounds(tenantId, ledgerTermId, {
      from: financeFrom,
      to: financeTo,
    });

    const feeTotalsRow = ledgerTermId
      ? await query(
          `WITH ${LEDGER_STUDENT_TOTALS_CTE}
           SELECT
             COALESCE(SUM(COALESCE(slt.term_fee, 0) + COALESCE(slt.arrears_amt, 0)), 0)::numeric AS total_expected,
             COALESCE(SUM(COALESCE(slt.paid_amt, 0)), 0)::numeric AS total_collected,
             COALESCE(SUM(COALESCE(slt.outstanding_amt, 0)), 0)::numeric AS total_outstanding
           FROM students s
           LEFT JOIN student_ledger_totals slt ON slt.student_id = s.id
           WHERE s.tenant_id = $1 AND ${ACTIVE_STUDENT_WHERE}`,
          [tenantId, ledgerTermId]
        )
          .then((r) => r.rows[0])
          .catch((feeErr) => {
            console.error('[financial-summary] fee totals query failed:', feeErr);
            return { total_expected: 0, total_collected: 0, total_outstanding: 0 };
          })
      : { total_expected: 0, total_collected: 0, total_outstanding: 0 };

    const totalExpected = parseFloat(feeTotalsRow.total_expected) || 0;

    // Same source as Fees → Outstanding Fees module (student_ledger net owing).
    let feeOutstanding = 0;
    if (ledgerTermId) {
      try {
        await recalculateTermOutstandingBalances(null, tenantId, ledgerTermId);
      } catch (recalcErr) {
        console.error('[financial-summary] outstanding recalc failed (continuing):', recalcErr);
      }
      try {
        const owingRows = await getOutstandingFeesFromLedger(null, tenantId, ledgerTermId, null);
        feeOutstanding = owingRows.reduce((sum, row) => sum + (row.outstanding || 0), 0);
        feeOutstanding = Math.round(feeOutstanding * 100) / 100;
      } catch (outErr) {
        console.error('[financial-summary] outstanding fees failed, falling back to CTE:', outErr);
        feeOutstanding = parseFloat(feeTotalsRow.total_outstanding) || 0;
      }
    }

    const [
      incomeExpenseAll,
      incomeExpenseTerm,
      feesCollectedAll,
      feesCollectedTermTxn,
      activity,
      cashPosition,
      collectionsByAccount,
      fundTransfers,
    ] = await Promise.all([
      getIncomeAndExpenseTotalsAll(tenantId).catch((err) => {
        console.error('[financial-summary] income/expense totals failed:', err);
        return { otherIncome: 0, totalExpenses: 0 };
      }),
      getIncomeAndExpenseTotalsInRange(tenantId, termBounds.from, termBounds.to).catch((err) => {
        console.error('[financial-summary] term income/expense failed:', err);
        return { otherIncome: 0, totalExpenses: 0 };
      }),
      getFeesCollectedAll(tenantId).catch((err) => {
        console.error('[financial-summary] fees collected (all) failed:', err);
        return 0;
      }),
      ledgerTermId
        ? getFeesCollectedForTerm(tenantId, ledgerTermId).catch((err) => {
            console.error('[financial-summary] fees collected (term) failed:', err);
            return 0;
          })
        : Promise.resolve(0),
      getDirectActivityTotals(tenantId, {
        financeFrom: termBounds.from,
        financeTo: termBounds.to,
        termMatch,
        termLike,
        termOnly,
        ledgerTermId,
      }).catch((err) => {
        console.error('[financial-summary] activity totals failed:', err);
        return { feesCollectedPeriod: 0, feesCollectedTerm: 0 };
      }),
      getCashPosition(tenantId).catch((err) => {
        console.error('[financial-summary] cash position failed:', err);
        return {
          totalCashPosition: 0,
          accountsTotal: 0,
          legacyUnlinkedNet: 0,
          accounts: [],
        };
      }),
      getCollectionsByAccount(tenantId, {
        financeFrom: termBounds.from,
        financeTo: termBounds.to,
        termMatch,
        termLike,
        termOnly,
        feesScope: 'term',
        ledgerTermId,
      }).catch((err) => {
        console.error('[financial-summary] collections by account failed:', err);
        return [];
      }),
      getFundTransfersReport(tenantId, {
        startDate: termBounds.from,
        endDate: termBounds.to,
      }).catch((err) => {
        console.error('[financial-summary] fund transfers failed:', err);
        return [];
      }),
    ]);

    // Term fees collected = real payment transactions for this term_id only.
    // Do NOT fall back to ledger paid_amt or fuzzy term-label matches — those can
    // count last-term credit / old receipts as "collected this term".
    const collectedThisTerm = feesCollectedTermTxn;
    const otherIncome = incomeExpenseTerm.otherIncome;
    const expenses = incomeExpenseTerm.totalExpenses;
    const collected = collectedThisTerm;
    const feesCollectedPeriod = activity.feesCollectedPeriod;
    const totalIncome = collected + otherIncome;
    const periodActivityNet = totalIncome - expenses;

    // System-wide carried totals (all terms / all transactions)
    const otherIncomeAll = incomeExpenseAll.otherIncome;
    const totalExpensesAll = incomeExpenseAll.totalExpenses;
    const collectedAll = feesCollectedAll;
    const totalOpeningBalance = getTotalOpeningBalance(cashPosition.accounts);
    const systemNetPosition = totalOpeningBalance + collectedAll + otherIncomeAll - totalExpensesAll;
    const accountSnapshots = buildAccountSnapshots(cashPosition.accounts);

    res.set('Cache-Control', 'no-store');
    res.json({
      totalExpected,
      /** Selected term fees collected (transactions / ledger). */
      collected,
      collectedThisTerm,
      collectedAll,
      feesCollectedPeriod,
      outstanding: feeOutstanding,
      /** School-wide net (opening + all fees + all income − all expenses). */
      netBalance: systemNetPosition,
      systemNetPosition,
      cashOnHand: cashPosition.totalCashPosition,
      /** Term activity net (this term only). */
      periodActivityNet,
      periodIncome: totalIncome,
      totalIncome,
      otherIncome,
      otherIncomeAll,
      totalExpenses: expenses,
      totalExpensesAll,
      totalOpeningBalance,
      accountSnapshots,
      accountsTotal: cashPosition.accountsTotal,
      legacyUnlinkedNet: cashPosition.legacyUnlinkedNet,
      collectionsByAccount,
      fundTransfers,
      collectionRate: totalExpected > 0 ? (collectedThisTerm / totalExpected) * 100 : 0,
      academicYear: academicYear,
      academicYearDisplay,
      financePeriodStart: termBounds.from,
      financePeriodEnd: termBounds.to,
      termLabel: term,
    });
  } catch (error) {
    console.error('Financial summary error:', error);
    res.status(500).json({ error: 'Failed to fetch financial summary' });
  }
});

/**
 * GET /api/reports/fees-by-class
 */
router.get('/fees-by-class', async (req: AuthRequest, res) => {
  try {
    const { tenantId, ledgerTermId } = await loadReportPeriod(req);

    if (!ledgerTermId) {
      res.set('Cache-Control', 'no-store');
      return res.json([]);
    }

    const feesByClassQuery = `
      WITH ${LEDGER_STUDENT_TOTALS_CTE}
      SELECT
        c.id,
        c.class_name AS name,
        COUNT(s.id)::int AS students,
        COALESCE(SUM(COALESCE(slt.term_fee, 0) + COALESCE(slt.arrears_amt, 0)), 0)::numeric AS expected,
        COALESCE(SUM(COALESCE(slt.paid_amt, 0)), 0)::numeric AS collected,
        COALESCE(SUM(COALESCE(slt.outstanding_amt, 0)), 0)::numeric AS outstanding
      FROM classes c
      LEFT JOIN students s ON s.class_assigned_id = c.id AND s.tenant_id = c.tenant_id AND ${ACTIVE_STUDENT_WHERE}
      LEFT JOIN student_ledger_totals slt ON slt.student_id = s.id
      WHERE c.tenant_id = $1
      GROUP BY c.id, c.class_name
      ORDER BY c.class_name
    `;

    const result = await query(feesByClassQuery, [tenantId, ledgerTermId]).catch((err) => {
      console.error('[fees-by-class] query failed:', err);
      return { rows: [] };
    });
    res.set('Cache-Control', 'no-store');
    res.json(result.rows);
  } catch (error) {
    console.error('Fees by class error:', error);
    res.status(500).json({ error: 'Failed to fetch fees by class' });
  }
});

/**
 * GET /api/reports/outstanding-fees
 */
router.get('/outstanding-fees', async (req: AuthRequest, res) => {
  try {
    const { tenantId, termMatch, termLike, termOnly, ledgerTermId } = await loadReportPeriod(req);

    if (!ledgerTermId) {
      res.set('Cache-Control', 'no-store');
      return res.json([]);
    }

    try {
      await ensureTenantLedgerSynced(tenantId);
    } catch (syncErr) {
      console.error('[outstanding-fees] Ledger sync failed (continuing):', syncErr);
    }

    const outstandingQuery = `
      WITH ${LEDGER_STUDENT_TOTALS_CTE},
      balances AS (
        SELECT
          s.id,
          s.first_name || ' ' || s.last_name AS name,
          c.class_name AS class,
          COALESCE(slt.outstanding_amt, 0)::numeric AS amount,
          COALESCE(
            (
              SELECT EXTRACT(DAY FROM NOW() - MAX(COALESCE(p2.payment_date, p2.created_at::date)::timestamp))::int
              FROM payments p2
              WHERE p2.tenant_id = $1 AND p2.student_id = s.id AND COALESCE(p2.is_voided, false) = false AND (${termPredPay('p2', 3, 4, 5)})
            ),
            0
          ) AS days
        FROM students s
        INNER JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
        LEFT JOIN student_ledger_totals slt ON slt.student_id = s.id
        WHERE s.tenant_id = $1 AND ${ACTIVE_STUDENT_WHERE}
      )
      SELECT id, name, class, amount, days
      FROM balances
      WHERE amount > 0
      ORDER BY amount DESC
      LIMIT 50
    `;

    const result = await query(outstandingQuery, [tenantId, ledgerTermId, termMatch, termLike, termOnly]);
    res.set('Cache-Control', 'no-store');
    res.json(result.rows);
  } catch (error) {
    console.error('Outstanding fees error:', error);
    res.status(500).json({ error: 'Failed to fetch outstanding fees' });
  }
});

/**
 * GET /api/reports/expenditure
 */
router.get('/expenditure', async (req: AuthRequest, res) => {
  try {
    const { tenantId, financeFrom, financeTo, ledgerTermId } = await loadReportPeriod(req);
    const scopeAll = String(req.query.scope || '').toLowerCase() === 'all';
    const termBounds = await resolveLedgerTermDateBounds(tenantId, ledgerTermId, {
      from: financeFrom,
      to: financeTo,
    });

    const expenditureQuery = scopeAll
      ? `
      SELECT
        COALESCE(NULLIF(TRIM(category), ''), 'Uncategorized') AS name,
        SUM(amount)::numeric AS value
      FROM expenses
      WHERE tenant_id = $1
      GROUP BY 1
      ORDER BY value DESC
    `
      : `
      SELECT
        COALESCE(NULLIF(TRIM(category), ''), 'Uncategorized') AS name,
        SUM(amount)::numeric AS value
      FROM expenses
      WHERE tenant_id = $1
        AND COALESCE(payment_date::date, created_at::date) >= $2::date
        AND COALESCE(payment_date::date, created_at::date) <= $3::date
      GROUP BY 1
      ORDER BY value DESC
    `;

    const result = scopeAll
      ? await query(expenditureQuery, [tenantId])
      : await query(expenditureQuery, [tenantId, termBounds.from, termBounds.to]);
    res.set('Cache-Control', 'no-store');
    res.json(result.rows);
  } catch (error) {
    console.error('Expenditure error:', error);
    res.status(500).json({ error: 'Failed to fetch expenditure report' });
  }
});

/**
 * GET /api/reports/payroll-summary
 */
router.get('/payroll-summary', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    await query(
      `INSERT INTO payroll_settings (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId]
    ).catch(() => {});

    const payrollQuery = `
      SELECT 
        t.full_name as name,
        COALESCE(c.class_name, 'Teacher') as role,
        t.monthly_salary::numeric as basic,
        CASE WHEN COALESCE(t.ssnit_enabled, true) = false THEN 0::numeric
          ELSE round((t.monthly_salary * COALESCE(ps.default_ssnit_percent, 5.5) / 100)::numeric, 2) END as ssnit,
        CASE WHEN COALESCE(t.ssnit_enabled, true) = false THEN t.monthly_salary::numeric
          ELSE round((t.monthly_salary - (t.monthly_salary * COALESCE(ps.default_ssnit_percent, 5.5) / 100))::numeric, 2) END as net
      FROM teachers t
      LEFT JOIN classes c ON t.class_assigned_id = c.id
      CROSS JOIN payroll_settings ps
      WHERE t.tenant_id = $1 AND ps.tenant_id = $1
        AND ${TEACHER_PAYROLL_WHERE}
      UNION ALL
      SELECT 
        s.full_name as name,
        COALESCE(s.position, 'Staff') as role,
        s.monthly_salary::numeric as basic,
        CASE WHEN COALESCE(s.ssnit_enabled, true) = false THEN 0::numeric
          ELSE round((s.monthly_salary * COALESCE(ps.default_ssnit_percent, 5.5) / 100)::numeric, 2) END as ssnit,
        CASE WHEN COALESCE(s.ssnit_enabled, true) = false THEN s.monthly_salary::numeric
          ELSE round((s.monthly_salary - (s.monthly_salary * COALESCE(ps.default_ssnit_percent, 5.5) / 100))::numeric, 2) END as net
      FROM other_staff s
      CROSS JOIN payroll_settings ps
      WHERE s.tenant_id = $1 AND ps.tenant_id = $1
        AND (s.employment_status = 'active' OR s.employment_status IS NULL)
    `;

    const result = await query(payrollQuery, [tenantId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Payroll summary error:', error);
    res.status(500).json({ error: 'Failed to fetch payroll summary' });
  }
});

/**
 * GET /api/reports/academic-performance
 */
router.get('/academic-performance', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    
    const performanceQuery = `
      SELECT 
        c.class_name as name,
        AVG(sg.score)::numeric as score
      FROM classes c
      JOIN grade_assignments ga ON ga.class_id = c.id
      JOIN student_grades sg ON sg.assignment_id = ga.id
      WHERE c.tenant_id = $1
      GROUP BY c.id, c.class_name
      ORDER BY score DESC
    `;

    const topPerformersQuery = `
      SELECT 
        s.first_name || ' ' || s.last_name as name,
        c.class_name as class,
        AVG(sg.score)::numeric as score
      FROM students s
      JOIN classes c ON s.class_assigned_id = c.id
      JOIN student_grades sg ON sg.student_id = s.id
      WHERE s.tenant_id = $1
      GROUP BY s.id, s.first_name, s.last_name, c.class_name
      ORDER BY score DESC
      LIMIT 10
    `;

    const [classPerformance, topPerformers] = await Promise.all([
      query(performanceQuery, [tenantId]),
      query(topPerformersQuery, [tenantId])
    ]);

    const scores = classPerformance.rows.map((r: any) => parseFloat(r.score));
    const schoolAverage = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    res.json({
      schoolAverage,
      classPerformance: classPerformance.rows,
      topPerformers: topPerformers.rows
    });
  } catch (error) {
    console.error('Academic performance error:', error);
    res.status(500).json({ error: 'Failed to fetch academic performance' });
  }
});

/**
 * GET /api/reports/attendance-summary
 */
router.get('/attendance-summary', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    
    const summaryQuery = `
      SELECT 
        attendance_date as date,
        COUNT(CASE WHEN present THEN 1 END)::int as present,
        COUNT(*)::int as total
      FROM attendance
      WHERE tenant_id = $1
      GROUP BY attendance_date
      ORDER BY attendance_date DESC
      LIMIT 30
    `;

    const result = await query(summaryQuery, [tenantId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Attendance summary error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});

/**
 * GET /api/reports/income-vs-expenditure
 */
router.get('/income-vs-expenditure', async (req: AuthRequest, res) => {
  try {
    const { tenantId, financeFrom, financeTo, ledgerTermId } = await loadReportPeriod(req);
    const termBounds = await resolveLedgerTermDateBounds(tenantId, ledgerTermId, {
      from: financeFrom,
      to: financeTo,
    });
    const startDate = ((req.query.startDate as string) || termBounds.from).split('T')[0];
    const endDate = ((req.query.endDate as string) || termBounds.to).split('T')[0];

    const monthlyQuery = `
      WITH bounds AS (
        SELECT $2::date AS d0, $3::date AS d1
      ),
      months AS (
        SELECT generate_series(
          date_trunc('month', (SELECT d0 FROM bounds)),
          date_trunc('month', (SELECT d1 FROM bounds)),
          interval '1 month'
        ) AS month
      ),
      monthly_income AS (
        SELECT date_trunc('month', COALESCE(income_date::timestamp, created_at::timestamp)) AS month, SUM(amount) AS amount
        FROM income
        WHERE tenant_id = $1
          AND COALESCE(income_date::date, created_at::date) BETWEEN (SELECT d0 FROM bounds) AND (SELECT d1 FROM bounds)
        GROUP BY 1
      ),
      monthly_fees AS (
        SELECT date_trunc('month', COALESCE(payment_date::timestamp, created_at::timestamp)) AS month,
          SUM(COALESCE(amount_paid, amount, 0)) AS amount
        FROM payments
        WHERE tenant_id = $1
          AND COALESCE(is_voided, false) = false
          AND COALESCE(payment_date::date, created_at::date) BETWEEN (SELECT d0 FROM bounds) AND (SELECT d1 FROM bounds)
        GROUP BY 1
      ),
      monthly_expenses AS (
        SELECT date_trunc('month', COALESCE(payment_date::timestamp, created_at::timestamp)) AS month, SUM(amount) AS amount
        FROM expenses
        WHERE tenant_id = $1
          AND COALESCE(payment_date::date, created_at::date) BETWEEN (SELECT d0 FROM bounds) AND (SELECT d1 FROM bounds)
        GROUP BY 1
      )
      SELECT
        to_char(m.month, 'Mon YYYY') AS name,
        COALESCE(mf.amount, 0)::numeric AS fees,
        COALESCE(mi.amount, 0)::numeric AS other_income,
        (COALESCE(mi.amount, 0) + COALESCE(mf.amount, 0))::numeric AS income,
        COALESCE(me.amount, 0)::numeric AS expense
      FROM months m
      LEFT JOIN monthly_income mi ON mi.month = m.month
      LEFT JOIN monthly_fees mf ON mf.month = m.month
      LEFT JOIN monthly_expenses me ON me.month = m.month
      ORDER BY m.month
    `;

    const result = await query(monthlyQuery, [tenantId, startDate, endDate]);
    res.set('Cache-Control', 'no-store');
    res.json(result.rows);
  } catch (error) {
    console.error('Income vs expenditure error:', error);
    res.status(500).json({ error: 'Failed to fetch income vs expenditure report' });
  }
});

/**
 * GET /api/reports/admin-overview
 * Lightweight dashboard counts — no full student/payment lists.
 */
router.get('/admin-overview', async (req: AuthRequest, res) => {
  try {
    const { tenantId, termMatch, termLike, termOnly, ledgerTermId } = await loadReportPeriod(req);

    try {
      await ensureTenantLedgerSynced(tenantId);
    } catch (syncErr) {
      console.error('[admin-overview] Ledger sync failed (continuing):', syncErr);
    }

    const feeMixQuery = ledgerTermId
      ? `
        WITH ${LEDGER_STUDENT_TOTALS_CTE},
        student_fee AS (
          SELECT
            s.id,
            COALESCE(slt.term_fee, 0)::numeric AS term_fee,
            COALESCE(slt.arrears_amt, 0)::numeric AS arrears_amt,
            COALESCE(slt.paid_amt, 0)::numeric AS paid_amt,
            COALESCE(slt.outstanding_amt, 0)::numeric AS outstanding_amt,
            COALESCE(slt.has_fee_structure, false) AS has_fee_structure,
            (COALESCE(slt.term_fee, 0) + COALESCE(slt.arrears_amt, 0) - COALESCE(slt.paid_amt, 0))::numeric AS net_position
          FROM students s
          LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
          LEFT JOIN student_ledger_totals slt ON slt.student_id = s.id
          WHERE s.tenant_id = $1 AND ${ACTIVE_STUDENT_WHERE}
            AND ${TERM_FEE_STUDENT_CLASS_FILTER}
        ),
        categorized AS (
          SELECT
            CASE
              WHEN term_fee <= 0 AND arrears_amt <= 0 AND paid_amt <= 0 AND NOT COALESCE(has_fee_structure, false) THEN 'noFee'
              WHEN net_position < -0.01 THEN 'credit'
              WHEN outstanding_amt <= 0.01 THEN 'paid'
              ELSE 'owing'
            END AS bucket,
            outstanding_amt AS owing_amt
          FROM student_fee
        )
        SELECT
          COUNT(*) FILTER (WHERE bucket = 'paid')::int AS paid,
          COUNT(*) FILTER (WHERE bucket = 'owing')::int AS owing,
          COUNT(*) FILTER (WHERE bucket = 'noFee')::int AS no_fee,
          COUNT(*) FILTER (WHERE bucket = 'credit')::int AS credit,
          COALESCE(SUM(CASE WHEN bucket = 'owing' THEN owing_amt ELSE 0 END), 0)::numeric AS total_owing
        FROM categorized`
      : `SELECT 0::int AS paid, 0::int AS owing, 0::int AS no_fee, 0::int AS credit, 0::numeric AS total_owing`;

    const [countsRes, enrollmentRes, feeMixRes, classesRes, paymentTrendRes] = await Promise.all([
      query(
        `SELECT
          COUNT(*) FILTER (WHERE ${ACTIVE_STUDENT_WHERE})::int AS student_total,
          COUNT(*) FILTER (WHERE ${ACTIVE_STUDENT_WHERE} AND LOWER(TRIM(COALESCE(s.gender, ''))) = 'male')::int AS student_male,
          COUNT(*) FILTER (WHERE ${ACTIVE_STUDENT_WHERE} AND LOWER(TRIM(COALESCE(s.gender, ''))) = 'female')::int AS student_female,
          COUNT(*) FILTER (WHERE COALESCE(s.enrollment_status, 'active') = 'pending')::int AS student_pending,
          COUNT(*) FILTER (WHERE COALESCE(s.enrollment_status, 'active') = 'inactive')::int AS student_inactive,
          COUNT(*) FILTER (WHERE COALESCE(s.enrollment_status, 'active') IN ('graduated', 'alumni'))::int AS student_alumni,
          (SELECT COUNT(*)::int FROM teachers t WHERE t.tenant_id = $1 AND ${TEACHER_COUNTABLE_WHERE}) AS teacher_total,
          (SELECT COUNT(*)::int FROM teachers t WHERE t.tenant_id = $1 AND ${TEACHER_COUNTABLE_WHERE}) AS teacher_active,
          (SELECT COALESCE(SUM(t.monthly_salary), 0)::numeric FROM teachers t WHERE t.tenant_id = $1 AND ${TEACHER_COUNTABLE_WHERE}) AS teacher_salary_budget,
          (SELECT COUNT(*)::int FROM teachers t WHERE t.tenant_id = $1 AND ${TEACHER_COUNTABLE_WHERE} AND LOWER(TRIM(COALESCE(t.gender, ''))) = 'male') AS teacher_male,
          (SELECT COUNT(*)::int FROM teachers t WHERE t.tenant_id = $1 AND ${TEACHER_COUNTABLE_WHERE} AND LOWER(TRIM(COALESCE(t.gender, ''))) = 'female') AS teacher_female,
          (SELECT COUNT(*)::int FROM other_staff o WHERE o.tenant_id = $1 AND ${OTHER_STAFF_COUNTABLE_WHERE}) AS other_staff_total,
          (SELECT COUNT(*)::int FROM other_staff o WHERE o.tenant_id = $1 AND ${OTHER_STAFF_COUNTABLE_WHERE}) AS other_staff_active,
          (SELECT COUNT(*)::int FROM other_staff o WHERE o.tenant_id = $1 AND ${OTHER_STAFF_COUNTABLE_WHERE} AND LOWER(TRIM(COALESCE(o.gender, ''))) = 'male') AS other_staff_male,
          (SELECT COUNT(*)::int FROM other_staff o WHERE o.tenant_id = $1 AND ${OTHER_STAFF_COUNTABLE_WHERE} AND LOWER(TRIM(COALESCE(o.gender, ''))) = 'female') AS other_staff_female,
          (SELECT COUNT(*)::int FROM classes c WHERE c.tenant_id = $1 AND TRIM(COALESCE(c.class_name, '')) <> '') AS class_total
        FROM students s
        WHERE s.tenant_id = $1`,
        [tenantId]
      ).catch((err) => {
        console.error('[admin-overview] student counts query failed:', err);
        return { rows: [{}] };
      }),
      query(
        `SELECT TRIM(COALESCE(c.class_name, 'Unassigned')) AS full_name, COUNT(*)::int AS count
         FROM students s
         LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
         WHERE s.tenant_id = $1 AND ${ACTIVE_STUDENT_WHERE}
         GROUP BY 1
         ORDER BY count DESC, full_name ASC
         LIMIT 20`,
        [tenantId]
      ).catch((err) => {
        console.error('[admin-overview] enrollment query failed:', err);
        return { rows: [] };
      }),
      query(feeMixQuery, ledgerTermId ? [tenantId, ledgerTermId] : []).catch((feeErr) => {
        console.error('[admin-overview] feeMix query failed:', feeErr);
        return { rows: [{ paid: 0, owing: 0, no_fee: 0, credit: 0, total_owing: 0 }] };
      }),
      query(
        `SELECT TRIM(class_name) AS class_name
         FROM classes
         WHERE tenant_id = $1 AND TRIM(COALESCE(class_name, '')) <> ''
         ORDER BY class_name ASC`,
        [tenantId]
      ).catch((err) => {
        console.error('[admin-overview] class list query failed:', err);
        return { rows: [] };
      }),
      query(
        `WITH days AS (
           SELECT generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
         ),
         term_pay AS (
           SELECT p.payment_date::date AS day, COALESCE(SUM(p.amount), 0)::numeric AS amount
           FROM payments p
           WHERE p.tenant_id = $1
             AND COALESCE(p.is_voided, false) = false
             AND COALESCE(p.payment_category, 'term_fee') = 'term_fee'
             AND p.payment_date >= CURRENT_DATE - INTERVAL '29 days'
             ${ledgerTermId ? 'AND p.term_id = $2' : ''}
           GROUP BY 1
         ),
         daily_pay AS (
           SELECT dfp.payment_date::date AS day, COALESCE(SUM(dfp.amount_paid), 0)::numeric AS amount
           FROM daily_fee_payments dfp
           WHERE dfp.tenant_id = $1
             AND dfp.payment_date >= CURRENT_DATE - INTERVAL '29 days'
           GROUP BY 1
         )
         SELECT
           d.day::text AS date,
           COALESCE(t.amount, 0)::numeric AS term_fees,
           COALESCE(dp.amount, 0)::numeric AS daily_fees,
           (COALESCE(t.amount, 0) + COALESCE(dp.amount, 0))::numeric AS total
         FROM days d
         LEFT JOIN term_pay t ON t.day = d.day
         LEFT JOIN daily_pay dp ON dp.day = d.day
         ORDER BY d.day ASC`,
        ledgerTermId ? [tenantId, ledgerTermId] : [tenantId]
      ).catch((err) => {
        console.error('[admin-overview] payment trend query failed:', err);
        return { rows: [] };
      }),
    ]);

    const counts = countsRes.rows[0] || {};
    const feeMix = feeMixRes.rows[0] || {};
    const enrollmentByClass = enrollmentRes.rows.map((row) => {
      const fullName = String(row.full_name || 'Unassigned');
      return {
        fullName,
        name: fullName.length > 14 ? `${fullName.slice(0, 12)}…` : fullName,
        count: Number(row.count) || 0,
      };
    });

    // Align owing amount/count with Fees → Outstanding Fees (student_ledger).
    let owingCount = Number(feeMix.owing) || 0;
    let totalOwing = parseFloat(feeMix.total_owing) || 0;
    if (ledgerTermId) {
      try {
        await recalculateTermOutstandingBalances(null, tenantId, ledgerTermId);
        const owingRows = await getOutstandingFeesFromLedger(null, tenantId, ledgerTermId, null);
        owingCount = owingRows.length;
        totalOwing = Math.round(owingRows.reduce((sum, row) => sum + (row.outstanding || 0), 0) * 100) / 100;
      } catch (outErr) {
        console.error('[admin-overview] outstanding fees align failed (using feeMix):', outErr);
      }
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      students: {
        total: Number(counts.student_total) || 0,
        pending: Number(counts.student_pending) || 0,
        inactive: Number(counts.student_inactive) || 0,
        alumni: Number(counts.student_alumni) || 0,
        male: Number(counts.student_male) || 0,
        female: Number(counts.student_female) || 0,
        other: Math.max(
          0,
          (Number(counts.student_total) || 0) -
            (Number(counts.student_male) || 0) -
            (Number(counts.student_female) || 0)
        ),
      },
      teachers: {
        total: Number(counts.teacher_total) || 0,
        active: Number(counts.teacher_active) || 0,
        monthlySalaryBudget: parseFloat(counts.teacher_salary_budget) || 0,
        male: Number(counts.teacher_male) || 0,
        female: Number(counts.teacher_female) || 0,
      },
      otherStaff: {
        total: Number(counts.other_staff_total) || 0,
        active: Number(counts.other_staff_active) || 0,
        male: Number(counts.other_staff_male) || 0,
        female: Number(counts.other_staff_female) || 0,
      },
      maleStaff:
        (Number(counts.teacher_male) || 0) + (Number(counts.other_staff_male) || 0),
      femaleStaff:
        (Number(counts.teacher_female) || 0) + (Number(counts.other_staff_female) || 0),
      classes: { total: Number(counts.class_total) || 0 },
      feeStatus: {
        paid: Number(feeMix.paid) || 0,
        owing: owingCount,
        noFee: Number(feeMix.no_fee) || 0,
        credit: Number(feeMix.credit) || 0,
        totalOwing,
      },
      enrollmentByClass,
      classNames: classesRes.rows.map((r) => String(r.class_name)).filter(Boolean),
      paymentTrend: paymentTrendRes.rows.map((row) => ({
        date: String(row.date).slice(0, 10),
        termFees: parseFloat(row.term_fees) || 0,
        dailyFees: parseFloat(row.daily_fees) || 0,
        total: parseFloat(row.total) || 0,
      })),
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to fetch admin overview' });
  }
});

/**
 * GET /api/reports/student-fee-roster
 * Paginated student fee status rows for administrator dashboard table.
 */
router.get('/student-fee-roster', async (req: AuthRequest, res) => {
  try {
    const { tenantId, ledgerTermId } = await loadReportPeriod(req);
    const className = String(req.query.className || '').trim();
    const search = String(req.query.search || '').trim().toLowerCase();

    if (!ledgerTermId) {
      res.set('Cache-Control', 'no-store');
      return res.json([]);
    }

    const rosterQuery = `
      WITH ${LEDGER_STUDENT_TOTALS_CTE},
      roster AS (
        SELECT
          s.id,
          s.student_id,
          s.admission_number,
          s.first_name,
          s.last_name,
          TRIM(COALESCE(c.class_name, 'Unassigned')) AS class_name,
          COALESCE(s.gender, '') AS gender,
          LOWER(COALESCE(s.enrollment_status, 'active')) AS enrollment_status,
          COALESCE(slt.term_fee, 0)::numeric AS term_fee,
          COALESCE(slt.arrears_amt, 0)::numeric AS arrears_amt,
          COALESCE(slt.paid_amt, 0)::numeric AS paid_amt,
          COALESCE(slt.has_fee_structure, false) AS has_fee_structure
        FROM students s
        LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
        LEFT JOIN student_ledger_totals slt ON slt.student_id = s.id
        WHERE s.tenant_id = $1 AND ${ACTIVE_STUDENT_WHERE}
          AND ${TERM_FEE_STUDENT_CLASS_FILTER}
      )
      SELECT
        id,
        student_id AS "studentId",
        admission_number AS "admissionNumber",
        first_name AS "firstName",
        last_name AS "lastName",
        class_name AS "className",
        gender,
        enrollment_status AS "enrollmentStatus",
        CASE
          WHEN NOT has_fee_structure AND term_fee <= 0 AND arrears_amt <= 0 AND paid_amt <= 0 THEN 'No Fee Set'
          WHEN (term_fee + arrears_amt - paid_amt) < -0.01 THEN 'Credit Balance'
          WHEN (term_fee + arrears_amt - paid_amt) <= 0.01 THEN 'Fully Paid'
          ELSE 'Amount Owing'
        END AS "feeStatus",
        CASE
          WHEN NOT has_fee_structure AND term_fee <= 0 AND arrears_amt <= 0 AND paid_amt <= 0 THEN 0
          WHEN (term_fee + arrears_amt - paid_amt) < -0.01 THEN ABS(term_fee + arrears_amt - paid_amt)
          WHEN (term_fee + arrears_amt - paid_amt) <= 0.01 THEN 0
          ELSE GREATEST(0, term_fee + arrears_amt - paid_amt)
        END::numeric AS balance
      FROM roster
      WHERE ($3 = '' OR class_name = $3)
        AND (
          $4 = ''
          OR LOWER(first_name || ' ' || last_name) LIKE '%' || $4 || '%'
          OR LOWER(student_id) LIKE '%' || $4 || '%'
          OR LOWER(COALESCE(admission_number, '')) LIKE '%' || $4 || '%'
        )
      ORDER BY last_name ASC, first_name ASC
      LIMIT 200
    `;

    const result = await query(rosterQuery, [tenantId, ledgerTermId, className, search]);
    res.set('Cache-Control', 'no-store');
    res.json(result.rows);
  } catch (error) {
    console.error('Student fee roster error:', error);
    res.status(500).json({ error: 'Failed to fetch student fee roster' });
  }
});

/**
 * GET /api/reports/collections-by-account
 */
router.get('/collections-by-account', async (req: AuthRequest, res) => {
  try {
    const { tenantId, termMatch, termLike, termOnly, financeFrom, financeTo } = await loadReportPeriod(req);
    const rows = await getCollectionsByAccount(tenantId, {
      financeFrom,
      financeTo,
      termMatch,
      termLike,
      termOnly,
    });
    res.set('Cache-Control', 'no-store');
    res.json(rows);
  } catch (error) {
    console.error('Collections by account error:', error);
    res.status(500).json({ error: 'Failed to fetch collections by account' });
  }
});

/**
 * GET /api/reports/fund-transfers
 */
router.get('/fund-transfers', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const scopeAll = String(req.query.scope || '').toLowerCase() === 'all';
    const limit = Math.min(parseInt(String(req.query.limit || '500'), 10) || 500, 1000);

    let startDate: string | undefined;
    let endDate: string | undefined;
    if (!scopeAll) {
      const period = await loadReportPeriod(req);
      startDate = period.financeFrom;
      endDate = period.financeTo;
    }

    const rows = await getFundTransfersReport(tenantId, {
      startDate,
      endDate,
      limit,
    });
    res.set('Cache-Control', 'no-store');
    res.json(rows);
  } catch (error) {
    console.error('Fund transfers report error:', error);
    res.status(500).json({ error: 'Failed to fetch fund transfers' });
  }
});

/**
 * GET /api/reports/recent-finance-activity
 */
router.get('/recent-finance-activity', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const limit = Math.min(parseInt(String(req.query.limit || '15'), 10) || 15, 30);

    const activityQuery = `
      SELECT type, amount, label, tx_date, created_at
      FROM (
        SELECT
          'payment'::text AS type,
          COALESCE(p.amount_paid, p.amount, 0)::numeric AS amount,
          TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')) AS label,
          COALESCE(p.payment_date::date, p.created_at::date) AS tx_date,
          p.created_at
        FROM payments p
        LEFT JOIN students s ON s.id = p.student_id AND s.tenant_id = p.tenant_id
        WHERE p.tenant_id = $1 AND COALESCE(p.is_voided, false) = false

        UNION ALL

        SELECT
          'income'::text,
          i.amount::numeric,
          COALESCE(NULLIF(TRIM(i.source), ''), 'Other income'),
          COALESCE(i.income_date::date, i.created_at::date),
          i.created_at
        FROM income i
        WHERE i.tenant_id = $1

        UNION ALL

        SELECT
          'expense'::text,
          e.amount::numeric,
          COALESCE(NULLIF(TRIM(e.title), ''), NULLIF(TRIM(e.category), ''), 'Expense'),
          COALESCE(e.payment_date::date, e.created_at::date),
          e.created_at
        FROM expenses e
        WHERE e.tenant_id = $1
      ) activity
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await query(activityQuery, [tenantId, limit]);
    res.set('Cache-Control', 'no-store');
    res.json(result.rows);
  } catch (error) {
    console.error('Recent finance activity error:', error);
    res.status(500).json({ error: 'Failed to fetch recent finance activity' });
  }
});

export default router;
