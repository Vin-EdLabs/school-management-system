import { getClient, query } from '../db/connection.js';
import { writeAuditLog } from './auditService.js';

export type FinanceWipeScope = 'student' | 'class' | 'school';

export type FinanceWipeInput = {
  tenantId: number;
  termId: number;
  scope: FinanceWipeScope;
  studentId?: number | null;
  classId?: number | null;
  actorUserId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type FinanceWipeResult = {
  success: boolean;
  wiped: {
    scope: FinanceWipeScope;
    termId: number;
    studentsAffected: number;
    ledgerRowsDeleted: number;
    paymentRowsDeleted: number;
    feeStructureRowsDeleted: number;
    snapshotRowsDeleted: number;
    arrearsCacheRowsDeleted: number;
    outstandingCacheRowsDeleted: number;
    invoiceRowsDeleted: number;
    closingBalanceRowsDeleted: number;
    studentChargeRowsDeleted: number;
  };
};

export async function wipeTermFinance(input: FinanceWipeInput): Promise<FinanceWipeResult> {
  const termRes = await query(
    `SELECT t.id, t.name, ay.name AS year_name
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.id = $1 AND t.tenant_id = $2`,
    [input.termId, input.tenantId]
  );
  if (termRes.rows.length === 0) {
    throw new Error('Term not found for this tenant.');
  }

  let studentIds: number[] = [];
  if (input.scope === 'student') {
    if (!input.studentId) throw new Error('student_id is required for student scope.');
    const s = await query(
      `SELECT id FROM students WHERE id = $1 AND tenant_id = $2`,
      [input.studentId, input.tenantId]
    );
    if (s.rows.length === 0) throw new Error('Student not found for this tenant.');
    studentIds = [Number(input.studentId)];
  } else if (input.scope === 'class') {
    if (!input.classId) throw new Error('class_id is required for class scope.');
    const rows = await query(
      `SELECT id FROM students WHERE class_assigned_id = $1 AND tenant_id = $2`,
      [input.classId, input.tenantId]
    );
    studentIds = rows.rows.map((r) => Number(r.id));
  } else {
    const rows = await query(`SELECT id FROM students WHERE tenant_id = $1`, [input.tenantId]);
    studentIds = rows.rows.map((r) => Number(r.id));
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    let ledgerRowsDeleted = 0;
    let paymentRowsDeleted = 0;
    let feeStructureRowsDeleted = 0;
    let snapshotRowsDeleted = 0;
    let arrearsCacheRowsDeleted = 0;
    let outstandingCacheRowsDeleted = 0;
    let invoiceRowsDeleted = 0;
    let closingBalanceRowsDeleted = 0;
    let studentChargeRowsDeleted = 0;

    if (studentIds.length > 0) {
      const ledgerDel = await client.query(
        `DELETE FROM student_ledger
         WHERE tenant_id = $1 AND term_id = $2 AND student_id = ANY($3::int[])`,
        [input.tenantId, input.termId, studentIds]
      );
      ledgerRowsDeleted = ledgerDel.rowCount ?? 0;

      const payDel = await client.query(
        `DELETE FROM payments
         WHERE tenant_id = $1 AND term_id = $2 AND student_id = ANY($3::int[])`,
        [input.tenantId, input.termId, studentIds]
      );
      paymentRowsDeleted = payDel.rowCount ?? 0;

      const arrearsDel = await client.query(
        `DELETE FROM term_arrears
         WHERE tenant_id = $1 AND student_id = ANY($2::int[])`,
        [input.tenantId, studentIds]
      );
      arrearsCacheRowsDeleted = arrearsDel.rowCount ?? 0;

      const outstandingDel = await client.query(
        `DELETE FROM term_outstanding_balances
         WHERE tenant_id = $1 AND term_id = $2 AND student_id = ANY($3::int[])`,
        [input.tenantId, input.termId, studentIds]
      );
      outstandingCacheRowsDeleted = outstandingDel.rowCount ?? 0;

      const closingDel = await client.query(
        `DELETE FROM term_closing_balances
         WHERE tenant_id = $1 AND term_id = $2 AND student_id = ANY($3::int[])`,
        [input.tenantId, input.termId, studentIds]
      );
      closingBalanceRowsDeleted = closingDel.rowCount ?? 0;

      const chargesDel = await client.query(
        `DELETE FROM student_charges
         WHERE tenant_id = $1 AND term_id = $2 AND student_id = ANY($3::int[])`,
        [input.tenantId, input.termId, studentIds]
      ).catch(() => ({ rowCount: 0 }));
      studentChargeRowsDeleted = chargesDel.rowCount ?? 0;

      const invoiceDel = await client.query(
        `DELETE FROM invoices
         WHERE tenant_id = $1 AND term_id = $2 AND student_id = ANY($3::int[])`,
        [input.tenantId, input.termId, studentIds]
      ).catch(() => ({ rowCount: 0 }));
      invoiceRowsDeleted = invoiceDel.rowCount ?? 0;
    }

    if (input.scope === 'school') {
      const fsIds = await client.query(
        `SELECT id FROM ledger_fee_structures WHERE tenant_id = $1 AND term_id = $2`,
        [input.tenantId, input.termId]
      );
      const ids = fsIds.rows.map((r) => Number(r.id));
      if (ids.length > 0) {
        await client.query(
          `DELETE FROM fee_structure_items WHERE tenant_id = $1 AND fee_structure_id = ANY($2::int[])`,
          [input.tenantId, ids]
        );
        const fsDel = await client.query(
          `DELETE FROM ledger_fee_structures WHERE tenant_id = $1 AND term_id = $2`,
          [input.tenantId, input.termId]
        );
        feeStructureRowsDeleted = fsDel.rowCount ?? 0;
      }

      const snapDel = await client.query(
        `DELETE FROM term_snapshots WHERE tenant_id = $1 AND term_id = $2`,
        [input.tenantId, input.termId]
      );
      snapshotRowsDeleted = snapDel.rowCount ?? 0;
    }

    await writeAuditLog({
      tenantId: input.tenantId,
      userId: input.actorUserId,
      userRole: 'super-admin',
      action: 'FINANCE_WIPE',
      entityType: 'TERM_FINANCE',
      entityId: input.termId,
      module: 'super-admin',
      summary: `Super admin finance wipe — term ${input.termId}, scope ${input.scope}`,
      details: {
        term_id: input.termId,
        scope: input.scope,
        student_id: input.studentId ?? null,
        class_id: input.classId ?? null,
        students_affected: studentIds.length,
        ledger_rows_deleted: ledgerRowsDeleted,
        payment_rows_deleted: paymentRowsDeleted,
      },
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    await client.query('COMMIT');

    return {
      success: true,
      wiped: {
        scope: input.scope,
        termId: input.termId,
        studentsAffected: studentIds.length,
        ledgerRowsDeleted,
        paymentRowsDeleted,
        feeStructureRowsDeleted,
        snapshotRowsDeleted,
        arrearsCacheRowsDeleted,
        outstandingCacheRowsDeleted,
        invoiceRowsDeleted,
        closingBalanceRowsDeleted,
        studentChargeRowsDeleted,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
