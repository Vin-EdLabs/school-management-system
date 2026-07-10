import type pg from 'pg';
import { query, getClient } from '../db/connection.js';
import {
  executeTermSwitchWithArrears,
  recalculateTermOutstandingBalances,
} from './ledgerFinanceService.js';
import {
  repairActiveAcademicTermLedgerLink,
  resolveLedgerTermForAcademicTerm,
} from './academicTermLedgerSyncService.js';
import { refreshArrearsForTenantWithClient } from './arrearsService.js';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildFullTermLabel(termName: string, year: string): string {
  const clean = String(termName || '').trim();
  const y = String(year || '').trim();
  if (!y) return clean;
  return clean.includes(y) ? clean : `${clean} ${y}`.trim();
}

export type TermCloseStudentRow = {
  studentId: number;
  closingBalance: number;
  termFee: number;
  totalPaid: number;
  arrearsBroughtIn: number;
  creditBroughtIn: number;
};

export type TermClosePreview = {
  academicTermId: number;
  ledgerTermId: number;
  termLabel: string;
  academicYear: string;
  nextTermLabel: string | null;
  nextAcademicTermId: number | null;
  nextLedgerTermId: number | null;
  nextAcademicYear: string | null;
  totalActiveStudents: number;
  totalStudentsWithBilling: number;
  totalFeesBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  totalCredits: number;
  canClose: boolean;
  closeBlockReason: string | null;
  studentRows: TermCloseStudentRow[];
};

export type TermCloseResult = {
  success: boolean;
  closedTermLabel: string;
  nextTermLabel: string | null;
  snapshotId: number | null;
  totalStudents: number;
  totalCollected: number;
  totalOutstanding: number;
  totalCredits: number;
  carryForward: {
    arrearsRowsInserted: number;
    creditRowsInserted: number;
    termFeesInserted: number;
  };
  error?: string;
};

async function fetchClosingBalances(
  run: typeof query,
  tenantId: number,
  ledgerTermId: number
): Promise<TermCloseStudentRow[]> {
  const res = await run(
    `SELECT
       student_id,
       COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS closing_balance,
       COALESCE(SUM(CASE WHEN entry_type = 'term_fee' THEN debit ELSE 0 END), 0) AS term_fee,
       COALESCE(SUM(CASE WHEN entry_type = 'payment' THEN credit ELSE 0 END), 0) AS total_paid,
       COALESCE(SUM(CASE WHEN entry_type = 'arrears' THEN debit ELSE 0 END), 0) AS arrears_brought_in,
       COALESCE(SUM(CASE WHEN entry_type = 'carry_forward_credit' THEN credit ELSE 0 END), 0) AS credit_brought_in
     FROM student_ledger
     WHERE tenant_id = $1 AND term_id = $2
     GROUP BY student_id`,
    [tenantId, ledgerTermId]
  );

  return res.rows.map((row) => ({
    studentId: Number(row.student_id),
    closingBalance: roundMoney(parseFloat(row.closing_balance) || 0),
    termFee: roundMoney(parseFloat(row.term_fee) || 0),
    totalPaid: roundMoney(parseFloat(row.total_paid) || 0),
    arrearsBroughtIn: roundMoney(parseFloat(row.arrears_brought_in) || 0),
    creditBroughtIn: roundMoney(parseFloat(row.credit_brought_in) || 0),
  }));
}

function aggregateCloseStats(rows: TermCloseStudentRow[]) {
  let totalFeesBilled = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let totalCredits = 0;

  for (const row of rows) {
    totalFeesBilled += row.termFee;
    totalCollected += row.totalPaid;
    if (row.closingBalance > 0) totalOutstanding += row.closingBalance;
    if (row.closingBalance < 0) totalCredits += Math.abs(row.closingBalance);
  }

  return {
    totalStudents: rows.length,
    totalFeesBilled: roundMoney(totalFeesBilled),
    totalCollected: roundMoney(totalCollected),
    totalOutstanding: roundMoney(totalOutstanding),
    totalCredits: roundMoney(totalCredits),
  };
}

async function countActiveStudents(tenantId: number): Promise<number> {
  const res = await query(
    `SELECT COUNT(*)::int AS total
     FROM students
     WHERE tenant_id = $1 AND COALESCE(enrollment_status, 'active') = 'active'`,
    [tenantId]
  );
  return Number(res.rows[0]?.total) || 0;
}

async function findNextAcademicTerm(
  tenantId: number,
  current: { id: number; year: string; start_date: string; term_name: string }
) {
  const res = await query(
    `SELECT * FROM academic_terms
     WHERE tenant_id = $1 AND COALESCE(is_archived, false) = false
     ORDER BY year ASC, start_date ASC NULLS LAST, id ASC`,
    [tenantId]
  );
  const rows = res.rows;
  const currentIdx = rows.findIndex((row) => Number(row.id) === Number(current.id));
  if (currentIdx < 0 || currentIdx >= rows.length - 1) return null;
  return rows[currentIdx + 1];
}

/** Preview summary shown in the Close Term confirmation modal. */
export async function getTermClosePreview(
  tenantId: number,
  academicTermId: number
): Promise<TermClosePreview> {
  const termRes = await query(
    `SELECT * FROM academic_terms WHERE id = $1 AND tenant_id = $2`,
    [academicTermId, tenantId]
  );
  if (termRes.rows.length === 0) {
    throw new Error('Academic term not found');
  }
  const current = termRes.rows[0];
  if (!current.is_active) {
    throw new Error('Only the current active term can be closed');
  }

  const termName = String(current.term_name || '').trim();
  const academicYear = String(current.year || '').trim();
  const termLabel = buildFullTermLabel(termName, academicYear);

  await repairActiveAcademicTermLedgerLink(tenantId);
  let ledgerTermId = await resolveLedgerTermForAcademicTerm(tenantId, academicTermId, {
    requireOpen: true,
  });
  if (!ledgerTermId) {
    throw new Error(`Ledger term for "${termLabel}" could not be resolved. Open Settings and confirm the active term.`);
  }

  const ledgerTermRes = await query(
    `SELECT status FROM terms WHERE id = $1 AND tenant_id = $2`,
    [ledgerTermId, tenantId]
  );
  const ledgerStatus = String(ledgerTermRes.rows[0]?.status || 'active');
  if (ledgerStatus === 'closed') {
    throw new Error('This term has already been closed');
  }
  if (ledgerStatus === 'closing') {
    throw new Error('This term is currently being closed. Please wait.');
  }

  const nextAcademic = await findNextAcademicTerm(tenantId, current);
  let nextTermLabel: string | null = null;
  let nextAcademicTermId: number | null = null;
  let nextLedgerTermId: number | null = null;
  let nextAcademicYear: string | null = null;
  let closeBlockReason: string | null = null;

  if (nextAcademic) {
    nextAcademicTermId = Number(nextAcademic.id);
    nextAcademicYear = String(nextAcademic.year || '').trim();
    nextTermLabel = buildFullTermLabel(String(nextAcademic.term_name), nextAcademicYear);
    nextLedgerTermId = await resolveLedgerTermForAcademicTerm(tenantId, nextAcademicTermId, {
      requireOpen: false,
    });
    if (!nextLedgerTermId) {
      closeBlockReason = `Could not prepare ledger for next term "${nextTermLabel}".`;
    }
  } else {
    closeBlockReason = 'Create the next academic term before closing the current term.';
  }

  const studentRows = await fetchClosingBalances(query, tenantId, ledgerTermId);
  const stats = aggregateCloseStats(studentRows);
  const totalActiveStudents = await countActiveStudents(tenantId);
  const canClose = !!(nextAcademicTermId && nextLedgerTermId);

  return {
    academicTermId,
    ledgerTermId,
    termLabel,
    academicYear,
    nextTermLabel,
    nextAcademicTermId,
    nextLedgerTermId,
    nextAcademicYear,
    totalActiveStudents,
    totalStudentsWithBilling: studentRows.length,
    totalFeesBilled: stats.totalFeesBilled,
    totalCollected: stats.totalCollected,
    totalOutstanding: stats.totalOutstanding,
    totalCredits: stats.totalCredits,
    canClose,
    closeBlockReason: canClose ? null : closeBlockReason,
    studentRows,
  };
}

/** Close the active term permanently, snapshot balances, carry forward, activate next term. */
export async function closeTermAndActivateNext(
  tenantId: number,
  academicTermId: number,
  closedByUserId: number
): Promise<TermCloseResult> {
  const preview = await getTermClosePreview(tenantId, academicTermId);
  if (!preview.canClose || !preview.nextAcademicTermId || !preview.nextLedgerTermId) {
    throw new Error(
      preview.closeBlockReason ||
        'No next term found. Create the next academic term before closing the current term.'
    );
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE terms SET status = 'closing' WHERE id = $1 AND tenant_id = $2`,
      [preview.ledgerTermId, tenantId]
    );

    const studentRows = await fetchClosingBalances(
      client.query.bind(client),
      tenantId,
      preview.ledgerTermId
    );
    const stats = aggregateCloseStats(studentRows);

    for (const row of studentRows) {
      if (row.closingBalance <= 0) continue;
      await client.query(
        `INSERT INTO term_closing_balances (tenant_id, term_id, student_id, carried_balance)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, term_id, student_id)
         DO UPDATE SET
           carried_balance = EXCLUDED.carried_balance,
           snapshotted_at = CURRENT_TIMESTAMP`,
        [tenantId, preview.ledgerTermId, row.studentId, row.closingBalance]
      );
      await client.query(
        `INSERT INTO term_outstanding_balances (tenant_id, term_id, student_id, outstanding_balance, calculated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (tenant_id, term_id, student_id)
         DO UPDATE SET outstanding_balance = EXCLUDED.outstanding_balance, calculated_at = CURRENT_TIMESTAMP`,
        [tenantId, preview.ledgerTermId, row.studentId, row.closingBalance]
      );
    }

    const termMetaRes = await client.query(
      `SELECT t.academic_year_id, t.name, ay.name AS year_name
       FROM terms t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [preview.ledgerTermId, tenantId]
    );
    const termMeta = termMetaRes.rows[0];

    const carryResult = await executeTermSwitchWithArrears(
      client,
      tenantId,
      preview.ledgerTermId,
      preview.nextLedgerTermId
    );

    const { loadGradeConfigForTenant, serializeGradeConfigSnapshot } = await import(
      './gradeConfigService.js'
    );
    const gradeConfigSnap = JSON.stringify(
      serializeGradeConfigSnapshot(await loadGradeConfigForTenant(tenantId))
    );

    const snapshotInsert = await client.query(
      `INSERT INTO term_snapshots (
         tenant_id, term_id, academic_year_id, snapshot_data, grade_config_snapshot,
         total_students, total_fees_billed, total_collected,
         total_outstanding, total_credits, created_by_user_id
       ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        tenantId,
        preview.ledgerTermId,
        termMeta?.academic_year_id ?? null,
        JSON.stringify({
          termLabel: preview.termLabel,
          academicYear: preview.academicYear,
          closedAt: new Date().toISOString(),
          students: studentRows,
          nextTermLabel: preview.nextTermLabel,
          carryForward: carryResult,
        }),
        gradeConfigSnap,
        stats.totalStudents,
        stats.totalFeesBilled,
        stats.totalCollected,
        stats.totalOutstanding,
        stats.totalCredits,
        closedByUserId,
      ]
    );

    const snapshotId = Number(snapshotInsert.rows[0]?.id) || null;
    const { archiveFeeStructuresForClosingTerm } = await import('./feeStructureArchiveService.js');
    await archiveFeeStructuresForClosingTerm(
      client,
      tenantId,
      preview.ledgerTermId,
      preview.termLabel,
      preview.academicYear,
      snapshotId,
      closedByUserId
    );

    await client.query(
      `UPDATE terms
       SET status = 'closed',
           is_current = false,
           closed_at = CURRENT_TIMESTAMP,
           closed_by_user_id = $3,
           snapshot_completed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,
      [preview.ledgerTermId, tenantId, closedByUserId]
    );

    await client.query('UPDATE academic_terms SET is_active = false WHERE tenant_id = $1', [
      tenantId,
    ]);
    await client.query(
      `UPDATE academic_terms SET is_active = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,
      [preview.nextAcademicTermId, tenantId]
    );
    await client.query(
      `UPDATE academic_terms
       SET ledger_term_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3`,
      [preview.nextLedgerTermId, preview.nextAcademicTermId, tenantId]
    );

    await client.query('UPDATE terms SET is_current = false WHERE tenant_id = $1', [tenantId]);
    await client.query(
      `UPDATE terms SET is_current = true, status = 'active'
       WHERE id = $1 AND tenant_id = $2`,
      [preview.nextLedgerTermId, tenantId]
    );

    await client.query(
      `UPDATE school_settings
       SET current_term = $1, current_year = $2, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $3`,
      [preview.nextTermLabel, preview.nextAcademicYear || preview.academicYear, tenantId]
    );

    await recalculateTermOutstandingBalances(client, tenantId, preview.nextLedgerTermId);
    await refreshArrearsForTenantWithClient(
      client,
      tenantId,
      preview.nextTermLabel!,
      preview.academicYear
    );

    await client.query(
      `UPDATE academic_terms
       SET closed_at = CURRENT_TIMESTAMP, is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,
      [academicTermId, tenantId]
    );

    await client.query('COMMIT');

    return {
      success: true,
      closedTermLabel: preview.termLabel,
      nextTermLabel: preview.nextTermLabel,
      snapshotId: Number(snapshotInsert.rows[0]?.id) || null,
      totalStudents: stats.totalStudents,
      totalCollected: stats.totalCollected,
      totalOutstanding: stats.totalOutstanding,
      totalCredits: stats.totalCredits,
      carryForward: {
        arrearsRowsInserted: carryResult.arrearsRowsInserted,
        creditRowsInserted: carryResult.creditRowsInserted,
        termFeesInserted: carryResult.termFeesInserted ?? 0,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    await query(
      `UPDATE terms SET status = 'active' WHERE id = $1 AND tenant_id = $2 AND status = 'closing'`,
      [preview.ledgerTermId, tenantId]
    ).catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Check if a ledger term is closed (for middleware / UI). */
export async function isLedgerTermClosed(
  tenantId: number,
  termId: number
): Promise<boolean> {
  const res = await query(
    `SELECT status FROM terms WHERE id = $1 AND tenant_id = $2`,
    [termId, tenantId]
  );
  return String(res.rows[0]?.status || '') === 'closed';
}

/** True when tenant has a term in closing state. */
export async function isTermClosingInProgress(tenantId: number): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM terms WHERE tenant_id = $1 AND status = 'closing' LIMIT 1`,
    [tenantId]
  );
  return res.rows.length > 0;
}
