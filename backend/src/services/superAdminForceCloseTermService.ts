import { getClient, query } from '../db/connection.js';
import { writeAuditLog } from './auditService.js';
import { archiveFeeStructuresForClosingTerm } from './feeStructureArchiveService.js';
import { markAcademicTermsClosedForLedger } from './academicTermLedgerSyncService.js';

export type ForceCloseLedgerTermInput = {
  tenantId: number;
  ledgerTermId: number;
  actorUserId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type ForceCloseLedgerTermResult = {
  success: boolean;
  ledgerTermId: number;
  termLabel: string;
  feeStructuresArchived: number;
  studentsSnapshotted: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function forceCloseLedgerTerm(
  input: ForceCloseLedgerTermInput
): Promise<ForceCloseLedgerTermResult> {
  const termRes = await query(
    `SELECT t.id, t.name, t.status, t.is_current, ay.name AS academic_year
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.id = $1 AND t.tenant_id = $2`,
    [input.ledgerTermId, input.tenantId]
  );
  if (termRes.rows.length === 0) {
    throw new Error('Ledger term not found for this tenant.');
  }

  const term = termRes.rows[0];
  const status = String(term.status || 'active');
  if (status === 'closed') {
    throw new Error('This term is already closed.');
  }
  if (status === 'closing') {
    throw new Error('This term is currently being closed. Please wait.');
  }

  const activeAcademicRes = await query(
    `SELECT id, ledger_term_id, term_name, year
     FROM academic_terms
     WHERE tenant_id = $1 AND is_active = true
     LIMIT 1`,
    [input.tenantId]
  );
  const activeAcademic = activeAcademicRes.rows[0];
  if (activeAcademic?.ledger_term_id != null && Number(activeAcademic.ledger_term_id) === input.ledgerTermId) {
    throw new Error('Cannot force-close the currently active academic term. Use Settings → Close Term instead.');
  }

  const termLabel = `${String(term.name || '').trim()} ${String(term.academic_year || '').trim()}`.trim();
  const client = await getClient();
  let studentsSnapshotted = 0;
  let feeStructuresArchived = 0;

  try {
    await client.query('BEGIN');

    const balancesRes = await client.query(
      `SELECT student_id,
              COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS closing_balance
       FROM student_ledger
       WHERE tenant_id = $1 AND term_id = $2
       GROUP BY student_id`,
      [input.tenantId, input.ledgerTermId]
    );

    for (const row of balancesRes.rows) {
      const closingBalance = roundMoney(parseFloat(row.closing_balance) || 0);
      if (closingBalance <= 0) continue;
      studentsSnapshotted++;
      await client.query(
        `INSERT INTO term_closing_balances (tenant_id, term_id, student_id, carried_balance)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, term_id, student_id)
         DO UPDATE SET
           carried_balance = EXCLUDED.carried_balance,
           snapshotted_at = CURRENT_TIMESTAMP`,
        [input.tenantId, input.ledgerTermId, Number(row.student_id), closingBalance]
      );
      await client.query(
        `INSERT INTO term_outstanding_balances (tenant_id, term_id, student_id, outstanding_balance, calculated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (tenant_id, term_id, student_id)
         DO UPDATE SET outstanding_balance = EXCLUDED.outstanding_balance, calculated_at = CURRENT_TIMESTAMP`,
        [input.tenantId, input.ledgerTermId, Number(row.student_id), closingBalance]
      );
    }

    const archive = await archiveFeeStructuresForClosingTerm(
      client,
      input.tenantId,
      input.ledgerTermId,
      termLabel,
      String(term.academic_year || ''),
      null,
      input.actorUserId
    );
    feeStructuresArchived = archive?.structure_count ?? 0;

    await client.query(
      `UPDATE terms
       SET status = 'closed',
           is_current = false,
           closed_at = CURRENT_TIMESTAMP,
           closed_by_user_id = $3,
           snapshot_completed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,
      [input.ledgerTermId, input.tenantId, input.actorUserId]
    );

    await markAcademicTermsClosedForLedger(
      client,
      input.tenantId,
      input.ledgerTermId,
      String(term.name || ''),
      String(term.academic_year || '')
    );

    await writeAuditLog({
      tenantId: input.tenantId,
      userId: input.actorUserId,
      userRole: 'super-admin',
      action: 'TERM_FORCE_CLOSED',
      entityType: 'LEDGER_TERM',
      entityId: input.ledgerTermId,
      module: 'super-admin',
      summary: `Super admin force-closed unused ledger term — ${termLabel}`,
      details: {
        ledger_term_id: input.ledgerTermId,
        term_label: termLabel,
        fee_structures_archived: feeStructuresArchived,
        students_snapshotted: studentsSnapshotted,
      },
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    await client.query('COMMIT');

    return {
      success: true,
      ledgerTermId: input.ledgerTermId,
      termLabel,
      feeStructuresArchived,
      studentsSnapshotted,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
