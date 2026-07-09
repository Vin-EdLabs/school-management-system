import type pg from 'pg';
import { query } from '../db/connection.js';
import { getStudentStatusForDate } from './dailyFeeService.js';
import type { StudentBalanceApiShape } from './ledgerBalanceService.js';

type QueryFn = typeof query;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** True when the student's assigned class uses daily feeding/fees (not termly ledger billing). */
export async function isDailyFeeStudent(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number
): Promise<boolean> {
  const run: QueryFn = client ? client.query.bind(client) : query;
  const res = await run(
    `SELECT COALESCE(c.fee_mode, 'term') AS fee_mode
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
     WHERE s.id = $1 AND s.tenant_id = $2`,
    [studentId, tenantId]
  );
  return String(res.rows[0]?.fee_mode || 'term') === 'daily';
}

/** Term-ledger balance shape for daily-fee students — no term credit, arrears, or term bills. */
export async function buildDailyFeeStudentBalanceShape(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId: number | null,
  termLabel: string | null
): Promise<StudentBalanceApiShape> {
  const run: QueryFn = client ? client.query.bind(client) : query;
  const label = termLabel || 'Current term';

  let dailyPaidThisTerm = 0;
  let coverageStatus = 'pending';
  let paidUntil: string | null = null;

  if (termId) {
    const paidRes = await run(
      `SELECT COALESCE(SUM(amount_paid), 0)::numeric AS total
       FROM daily_fee_payments
       WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3`,
      [tenantId, studentId, termId]
    );
    dailyPaidThisTerm = roundMoney(parseFloat(String(paidRes.rows[0]?.total)) || 0);

    const today = new Date().toISOString().slice(0, 10);
    try {
      const st = await getStudentStatusForDate(run, tenantId, studentId, termId, today);
      coverageStatus = st.status;
      if ('paidUntil' in st && st.paidUntil) paidUntil = st.paidUntil;
      else if ('lastPaidUntil' in st && st.lastPaidUntil) paidUntil = st.lastPaidUntil;
    } catch {
      coverageStatus = 'pending';
    }
  }

  const status: StudentBalanceApiShape['status'] =
    coverageStatus === 'paid' || coverageStatus === 'covered'
      ? 'Cleared'
      : coverageStatus === 'pending' || coverageStatus === 'expired'
        ? 'Owing'
        : 'NotSet';

  return {
    feeMode: 'daily',
    dailyCoverageStatus: coverageStatus,
    dailyPaidUntil: paidUntil,
    currentTermFee: 0,
    currentTermName: label,
    activeTermId: termId,
    arrearLines: [],
    totalArrears: 0,
    creditBroughtForward: 0,
    totalDue: 0,
    paidLines:
      dailyPaidThisTerm > 0
        ? [{ termName: `${label} (daily feeding)`, amount: dailyPaidThisTerm }]
        : [],
    totalPaid: dailyPaidThisTerm,
    outstanding: 0,
    credit: 0,
    netBalance: 0,
    status,
    paymentsMade: dailyPaidThisTerm,
    totalCharged: 0,
    individualCharges: 0,
    individualChargeLines: [],
    termRows: [
      {
        termId,
        termName: label,
        termFee: 0,
        amountPaid: dailyPaidThisTerm,
        outstanding: 0,
        displayOutstanding: 0,
        isActiveTerm: true,
      },
    ],
  };
}

/** Student IDs in daily-fee classes for a tenant (batch carry-forward / term-fee exclusions). */
export async function listDailyFeeStudentIds(
  client: pg.PoolClient,
  tenantId: number
): Promise<Set<number>> {
  const res = await client.query(
    `SELECT s.id
     FROM students s
     INNER JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
     WHERE s.tenant_id = $1
       AND COALESCE(c.fee_mode, 'term') = 'daily'`,
    [tenantId]
  );
  return new Set(res.rows.map((r) => Number(r.id)));
}
