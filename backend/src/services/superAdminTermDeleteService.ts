import { getClient, query } from '../db/connection.js';
import { writeAuditLog } from './auditService.js';

type CountRow = { count: string | number; amount?: string | number | null };

async function safeCount(
  sql: string,
  params: unknown[]
): Promise<{ count: number; amount: number }> {
  try {
    const res = await query(sql, params);
    const row = (res.rows[0] || {}) as CountRow;
    return {
      count: Number(row.count) || 0,
      amount: parseFloat(String(row.amount ?? 0)) || 0,
    };
  } catch {
    return { count: 0, amount: 0 };
  }
}

export type TermFinanceLinkItem = {
  key: string;
  label: string;
  count: number;
  amount: number;
  willDelete: boolean;
  note?: string;
};

export type TermFinanceDeletePreview = {
  tenantId: number;
  ledgerTermId: number;
  termName: string;
  academicYear: string;
  status: string;
  isCurrent: boolean;
  startDate: string | null;
  endDate: string | null;
  closedAt: string | null;
  academicTerms: Array<{
    id: number;
    termName: string;
    year: string;
    isActive: boolean;
    closedAt: string | null;
  }>;
  totals: {
    studentsWithLedger: number;
    totalDebits: number;
    totalCredits: number;
    netBalance: number;
    paymentsAmount: number;
    feeStructuresTotal: number;
  };
  links: TermFinanceLinkItem[];
  preserved: string[];
  canDelete: boolean;
  blockReason: string | null;
};

export type TermFinanceDeleteResult = {
  success: boolean;
  deletedLedgerTermId: number;
  termLabel: string;
  academicYear: string;
  deleted: Record<string, number>;
  academicTermsUnlinked: number;
};

async function loadTermMeta(tenantId: number, ledgerTermId: number) {
  const termRes = await query(
    `SELECT t.id, t.name, t.status, t.is_current, t.closed_at, t.academic_year_id,
            t.start_date, t.end_date,
            COALESCE(ay.label, ay.name) AS year_name
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.id = $1 AND t.tenant_id = $2`,
    [ledgerTermId, tenantId]
  );
  if (!termRes.rows.length) {
    throw new Error('Ledger term not found for this school.');
  }
  return termRes.rows[0] as {
    id: number;
    name: string;
    status: string;
    is_current: boolean;
    closed_at: string | null;
    academic_year_id: number;
    year_name: string;
    start_date: string | null;
    end_date: string | null;
  };
}

export async function getTermFinanceDeletePreview(
  tenantId: number,
  ledgerTermId: number
): Promise<TermFinanceDeletePreview> {
  const term = await loadTermMeta(tenantId, ledgerTermId);

  const academicRes = await query(
    `SELECT id, term_name, year, is_active, closed_at
     FROM academic_terms
     WHERE tenant_id = $1 AND ledger_term_id = $2
     ORDER BY start_date ASC NULLS LAST, id ASC`,
    [tenantId, ledgerTermId]
  );

  const [
    ledger,
    payments,
    feeStructures,
    feeItems,
    invoices,
    outstanding,
    closing,
    charges,
    snapshots,
    archives,
    dailyStructures,
    dailyPayments,
    dailyCollections,
    closures,
    studentsWithLedger,
  ] = await Promise.all([
    safeCount(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(debit), 0)::numeric AS amount
       FROM student_ledger WHERE tenant_id = $1 AND term_id = $2`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::numeric AS amount
       FROM payments
       WHERE tenant_id = $1 AND term_id = $2 AND COALESCE(is_voided, false) = false`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(total), 0)::numeric AS amount
       FROM ledger_fee_structures WHERE tenant_id = $1 AND term_id = $2`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(*)::int AS count, 0::numeric AS amount
       FROM fee_structure_items fsi
       WHERE fsi.tenant_id = $1
         AND fsi.fee_structure_id IN (
           SELECT id FROM ledger_fee_structures WHERE tenant_id = $1 AND term_id = $2
         )`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(COALESCE(total_due, 0)), 0)::numeric AS amount
       FROM invoices WHERE tenant_id = $1 AND term_id = $2`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(outstanding_balance), 0)::numeric AS amount
       FROM term_outstanding_balances WHERE tenant_id = $1 AND term_id = $2`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(carried_balance), 0)::numeric AS amount
       FROM term_closing_balances WHERE tenant_id = $1 AND term_id = $2`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::numeric AS amount
       FROM student_charges WHERE tenant_id = $1 AND term_id = $2`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(*)::int AS count, 0::numeric AS amount
       FROM term_snapshots WHERE tenant_id = $1 AND term_id = $2`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(*)::int AS count, 0::numeric AS amount
       FROM term_fee_structure_archives WHERE tenant_id = $1 AND ledger_term_id = $2`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(*)::int AS count, 0::numeric AS amount
       FROM daily_fee_structures WHERE tenant_id = $1 AND term_id = $2`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount_paid), 0)::numeric AS amount
       FROM daily_fee_payments WHERE tenant_id = $1 AND term_id = $2`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(*)::int AS count, 0::numeric AS amount
       FROM daily_fee_collection_records WHERE tenant_id = $1 AND term_id = $2`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(*)::int AS count, 0::numeric AS amount
       FROM school_closure_days WHERE tenant_id = $1 AND term_id = $2`,
      [tenantId, ledgerTermId]
    ),
    safeCount(
      `SELECT COUNT(DISTINCT student_id)::int AS count, 0::numeric AS amount
       FROM student_ledger WHERE tenant_id = $1 AND term_id = $2`,
      [tenantId, ledgerTermId]
    ),
  ]);

  const creditRes = await safeCount(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(credit), 0)::numeric AS amount
     FROM student_ledger WHERE tenant_id = $1 AND term_id = $2`,
    [tenantId, ledgerTermId]
  );

  const links: TermFinanceLinkItem[] = [
    {
      key: 'student_ledger',
      label: 'Student ledger entries',
      count: ledger.count,
      amount: ledger.amount,
      willDelete: true,
      note: 'Term fees, arrears, payments, adjustments',
    },
    { key: 'payments', label: 'Payment records', count: payments.count, amount: payments.amount, willDelete: true },
    {
      key: 'ledger_fee_structures',
      label: 'Fee structures',
      count: feeStructures.count,
      amount: feeStructures.amount,
      willDelete: true,
    },
    {
      key: 'fee_structure_items',
      label: 'Fee structure line items',
      count: feeItems.count,
      amount: 0,
      willDelete: true,
    },
    { key: 'invoices', label: 'Invoices', count: invoices.count, amount: invoices.amount, willDelete: true },
    {
      key: 'student_charges',
      label: 'Student charges',
      count: charges.count,
      amount: charges.amount,
      willDelete: true,
    },
    {
      key: 'term_outstanding_balances',
      label: 'Outstanding balance cache',
      count: outstanding.count,
      amount: outstanding.amount,
      willDelete: true,
    },
    {
      key: 'term_closing_balances',
      label: 'Closing balance snapshots',
      count: closing.count,
      amount: closing.amount,
      willDelete: true,
    },
    { key: 'term_snapshots', label: 'Term close snapshots', count: snapshots.count, amount: 0, willDelete: true },
    {
      key: 'term_fee_structure_archives',
      label: 'Fee structure archives',
      count: archives.count,
      amount: 0,
      willDelete: true,
    },
    {
      key: 'daily_fee_structures',
      label: 'Daily fee structures',
      count: dailyStructures.count,
      amount: 0,
      willDelete: true,
    },
    {
      key: 'daily_fee_payments',
      label: 'Daily fee payments',
      count: dailyPayments.count,
      amount: dailyPayments.amount,
      willDelete: true,
    },
    {
      key: 'daily_fee_collection_records',
      label: 'Daily fee collection records',
      count: dailyCollections.count,
      amount: 0,
      willDelete: true,
    },
    {
      key: 'school_closure_days',
      label: 'School closure days (daily fees)',
      count: closures.count,
      amount: 0,
      willDelete: true,
    },
    {
      key: 'ledger_term_row',
      label: 'Ledger term row',
      count: 1,
      amount: 0,
      willDelete: true,
      note: `Term id #${ledgerTermId} will be permanently removed (no replacement ledger)`,
    },
    {
      key: 'academic_term_links',
      label: 'Linked academic term records',
      count: academicRes.rows.length,
      amount: 0,
      willDelete: true,
      note: 'Unlinked and archived — students/classes kept',
    },
  ];

  const activeAcademic = academicRes.rows.find((r) => r.is_active);
  return {
    tenantId,
    ledgerTermId,
    termName: String(term.name),
    academicYear: String(term.year_name),
    status: String(term.status || 'active'),
    isCurrent: Boolean(term.is_current),
    startDate: term.start_date ? String(term.start_date).slice(0, 10) : null,
    endDate: term.end_date ? String(term.end_date).slice(0, 10) : null,
    closedAt: term.closed_at ? String(term.closed_at) : null,
    academicTerms: academicRes.rows.map((r) => ({
      id: Number(r.id),
      termName: String(r.term_name),
      year: String(r.year),
      isActive: Boolean(r.is_active),
      closedAt: r.closed_at ? String(r.closed_at) : null,
    })),
    totals: {
      studentsWithLedger: studentsWithLedger.count,
      totalDebits: ledger.amount,
      totalCredits: creditRes.amount,
      netBalance: Math.round((ledger.amount - creditRes.amount) * 100) / 100,
      paymentsAmount: payments.amount,
      feeStructuresTotal: feeStructures.amount,
    },
    links,
    preserved: [
      'Students and admission records',
      'Classes, teachers, and staff',
      'School income & expense (non-term ledger)',
      'Salary / payroll records',
      'Grades, attendance, and report cards',
      'Other terms’ finance data',
    ],
    canDelete: true,
    blockReason: activeAcademic
      ? 'Warning: this is linked to the currently active academic term. Deleting removes it completely — set another term active afterwards if needed.'
      : null,
  };
}

async function deleteWhere(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rowCount: number | null }> },
  sql: string,
  params: unknown[]
): Promise<number> {
  try {
    const res = await client.query(sql, params);
    return res.rowCount ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Permanently wipe all finance for a ledger term and delete the term row.
 * Does NOT recreate a ledger. Students and non-term finance are preserved.
 */
export async function deleteTermCompletely(input: {
  tenantId: number;
  ledgerTermId: number;
  actorUserId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<TermFinanceDeleteResult> {
  const preview = await getTermFinanceDeletePreview(input.tenantId, input.ledgerTermId);
  if (!preview.canDelete) {
    throw new Error(preview.blockReason || 'This term cannot be deleted.');
  }

  const term = await loadTermMeta(input.tenantId, input.ledgerTermId);
  const termLabel = `${term.name} ${term.year_name}`.trim();
  const client = await getClient();
  const deleted: Record<string, number> = {};

  try {
    await client.query('BEGIN');

    const unlink = await client.query(
      `UPDATE academic_terms
       SET ledger_term_id = NULL,
           is_active = false,
           is_archived = true,
           closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $1 AND ledger_term_id = $2
       RETURNING id`,
      [input.tenantId, input.ledgerTermId]
    );
    deleted.academic_terms_unlinked = unlink.rowCount ?? 0;

    const fsIdsRes = await client.query(
      `SELECT id FROM ledger_fee_structures WHERE tenant_id = $1 AND term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );
    const fsIds = fsIdsRes.rows.map((r) => Number(r.id));
    deleted.fee_structure_items = fsIds.length
      ? await deleteWhere(
          client,
          `DELETE FROM fee_structure_items WHERE tenant_id = $1 AND fee_structure_id = ANY($2::int[])`,
          [input.tenantId, fsIds]
        )
      : 0;

    deleted.ledger_fee_structures = await deleteWhere(
      client,
      `DELETE FROM ledger_fee_structures WHERE tenant_id = $1 AND term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );
    deleted.student_ledger = await deleteWhere(
      client,
      `DELETE FROM student_ledger WHERE tenant_id = $1 AND term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );
    deleted.payments = await deleteWhere(
      client,
      `DELETE FROM payments WHERE tenant_id = $1 AND term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );
    deleted.invoices = await deleteWhere(
      client,
      `DELETE FROM invoices WHERE tenant_id = $1 AND term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );
    deleted.student_charges = await deleteWhere(
      client,
      `DELETE FROM student_charges WHERE tenant_id = $1 AND term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );
    deleted.term_outstanding_balances = await deleteWhere(
      client,
      `DELETE FROM term_outstanding_balances WHERE tenant_id = $1 AND term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );
    deleted.term_closing_balances = await deleteWhere(
      client,
      `DELETE FROM term_closing_balances WHERE tenant_id = $1 AND term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );
    deleted.term_fee_structure_archives = await deleteWhere(
      client,
      `DELETE FROM term_fee_structure_archives WHERE tenant_id = $1 AND ledger_term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );
    deleted.term_snapshots = await deleteWhere(
      client,
      `DELETE FROM term_snapshots WHERE tenant_id = $1 AND term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );
    deleted.daily_fee_payments = await deleteWhere(
      client,
      `DELETE FROM daily_fee_payments WHERE tenant_id = $1 AND term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );
    deleted.daily_fee_collection_records = await deleteWhere(
      client,
      `DELETE FROM daily_fee_collection_records WHERE tenant_id = $1 AND term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );
    deleted.daily_fee_structures = await deleteWhere(
      client,
      `DELETE FROM daily_fee_structures WHERE tenant_id = $1 AND term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );
    deleted.school_closure_days = await deleteWhere(
      client,
      `DELETE FROM school_closure_days WHERE tenant_id = $1 AND term_id = $2`,
      [input.tenantId, input.ledgerTermId]
    );

    deleted.ledger_term = await deleteWhere(
      client,
      `DELETE FROM terms WHERE id = $1 AND tenant_id = $2`,
      [input.ledgerTermId, input.tenantId]
    );
    if (deleted.ledger_term < 1) {
      throw new Error('Failed to delete ledger term row (it may still be referenced).');
    }

    await writeAuditLog({
      tenantId: input.tenantId,
      userId: input.actorUserId,
      userRole: 'super-admin',
      action: 'TERM_FINANCE_DELETE',
      entityType: 'LEDGER_TERM',
      entityId: input.ledgerTermId,
      module: 'super-admin',
      summary: `Super admin permanently deleted term finance — ${termLabel} (#${input.ledgerTermId})`,
      details: {
        deleted_ledger_term_id: input.ledgerTermId,
        term_name: term.name,
        academic_year: term.year_name,
        start_date: term.start_date,
        end_date: term.end_date,
        deleted,
      },
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    await client.query('COMMIT');

    return {
      success: true,
      deletedLedgerTermId: input.ledgerTermId,
      termLabel,
      academicYear: String(term.year_name),
      deleted,
      academicTermsUnlinked: deleted.academic_terms_unlinked ?? 0,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** @deprecated Use deleteTermCompletely — kept as alias for route compatibility. */
export const deleteAndResetLedgerTerm = deleteTermCompletely;
