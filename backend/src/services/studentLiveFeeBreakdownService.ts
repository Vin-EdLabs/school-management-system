import type pg from 'pg';
import {
  getStudentFullBalance,
  fullBalanceToLiveBreakdown,
  liveBreakdownToSummary,
  resolveActiveLedgerTerm,
} from './studentUnifiedBalanceService.js';

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

export type StudentLiveFeeBreakdown = {
  currentTermFee: number;
  currentTermName: string | null;
  activeTermId: number | null;
  arrearLines: LiveFeeLine[];
  totalArrears: number;
  totalDue: number;
  paidLines: LiveFeeLine[];
  totalPaid: number;
  outstanding: number;
  credit: number;
  status: 'Owing' | 'Cleared' | 'Credit' | 'NotSet';
  termRows: LiveFeeTermRow[];
};

export { resolveActiveLedgerTerm, liveBreakdownToSummary };

/**
 * Live fee breakdown — delegates to studentUnifiedBalanceService (ledger-only, no legacy fallback).
 */
export async function getStudentLiveFeeBreakdown(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  activeTermId?: number | null
): Promise<StudentLiveFeeBreakdown | null> {
  const balance = await getStudentFullBalance(client, tenantId, studentId, activeTermId);
  if (!balance) return null;

  const { ledgerTermId } = await resolveActiveLedgerTerm(
    client ? client.query.bind(client) : (await import('../db/connection.js')).query,
    tenantId,
    activeTermId
  );

  return fullBalanceToLiveBreakdown(balance, ledgerTermId);
}
