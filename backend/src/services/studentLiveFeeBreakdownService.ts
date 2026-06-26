import type pg from 'pg';
import {
  getStudentBalanceFromLedger,
  getArrearsBreakdownFromLedger,
  ledgerBalanceToApiShape,
  type StudentBalanceApiShape,
} from './ledgerBalanceService.js';
import { resolveActiveLedgerTerm } from './studentUnifiedBalanceService.js';
import { enrichBalanceShapeWithExpectedFees } from './effectiveStudentBalanceService.js';
import { query } from '../db/connection.js';

export type LiveFeeLine = { termName: string; amount: number };

export type LiveFeeTermRow = {
  termId: number | null;
  termName: string;
  termFee: number;
  amountPaid: number;
  outstanding: number;
  displayOutstanding: number;
  isActiveTerm: boolean;
};

export type StudentLiveFeeBreakdown = StudentBalanceApiShape;

export { resolveActiveLedgerTerm };

export function liveBreakdownToSummary(balance: StudentLiveFeeBreakdown) {
  return {
    termFee: balance.currentTermFee,
    arrears: balance.totalArrears,
    totalDue: balance.totalDue,
    totalPaid: balance.totalPaid,
    outstanding: balance.outstanding,
    credit: balance.credit,
    status: balance.status,
  };
}

/**
 * Live fee breakdown — delegates to getStudentBalanceFromLedger (ledger-only).
 */
export async function getStudentLiveFeeBreakdown(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  activeTermId?: number | null
): Promise<StudentLiveFeeBreakdown | null> {
  const run = client ? client.query.bind(client) : query;
  const studentRes = await run(`SELECT id FROM students WHERE id = $1 AND tenant_id = $2`, [
    studentId,
    tenantId,
  ]);
  if (studentRes.rows.length === 0) return null;

  const { ledgerTermId } = await resolveActiveLedgerTerm(run, tenantId, activeTermId ?? undefined);
  const termIdForBalance = ledgerTermId ?? activeTermId ?? null;
  const shape = await ledgerBalanceToApiShape(client, tenantId, studentId, termIdForBalance);
  if (!shape) return null;

  const effectiveTermId = shape.activeTermId ?? ledgerTermId ?? activeTermId ?? null;
  if (!effectiveTermId) return shape;

  return enrichBalanceShapeWithExpectedFees(client, tenantId, studentId, effectiveTermId, shape);
}

/** Payment context from ledger — used when recording payments. */
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
  const run = client ? client.query.bind(client) : query;
  const { ledgerTermId, academicYearId, termLabel } = await resolveActiveLedgerTerm(run, tenantId);
  if (!ledgerTermId || !academicYearId || !termLabel) return null;

  const balance = await getStudentBalanceFromLedger(client, tenantId, studentId, ledgerTermId);

  return {
    ledgerTermId,
    academicYearId,
    termLabel,
    termFee: balance.termFee,
    arrears: balance.arrears,
    totalDue: balance.totalDue,
    totalPaid: balance.paymentsMade,
    outstandingBefore: balance.outstanding,
    creditBroughtForward: balance.creditFromCarryForward,
  };
}

export { getStudentBalanceFromLedger, getArrearsBreakdownFromLedger, ledgerBalanceToApiShape };
