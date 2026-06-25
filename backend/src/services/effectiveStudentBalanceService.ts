import type pg from 'pg';
import { query } from '../db/connection.js';
import { beneficiaryAdjustedFee, type BeneficiaryStudentRow } from '../utils/beneficiaryFee.js';
import {
  SQL_EFFECTIVE_FEE_STRUCTURE_TOTAL,
  SQL_FEE_STRUCTURE_CLASS_MATCH,
} from '../utils/feeStructureSql.js';
import type { StudentBalanceApiShape } from './ledgerBalanceService.js';

type QueryFn = typeof query;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ResolvedStudentFeeStructure = {
  feeStructureId: number;
  grossTotal: number;
  netTotal: number;
  discountAmount: number;
};

/** Find fee structure for a student in a term (class id or normalized class name). */
export async function resolveLedgerFeeStructureForStudent(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId: number
): Promise<ResolvedStudentFeeStructure | null> {
  const run: QueryFn = client ? client.query.bind(client) : query;

  const res = await run(
    `SELECT DISTINCT ON (s.id)
       fs.id AS fee_structure_id,
       (${SQL_EFFECTIVE_FEE_STRUCTURE_TOTAL}) AS gross_total,
       s.is_beneficiary,
       s.discount_type,
       s.discount_value
     FROM students s
     INNER JOIN classes c_student ON c_student.id = s.class_assigned_id AND c_student.tenant_id = s.tenant_id
     INNER JOIN ledger_fee_structures fs ON fs.tenant_id = s.tenant_id
       AND fs.term_id = $3
       AND ${SQL_FEE_STRUCTURE_CLASS_MATCH}
     WHERE s.tenant_id = $1
       AND s.id = $2
       AND s.class_assigned_id IS NOT NULL
     ORDER BY s.id, (fs.class_id = s.class_assigned_id) DESC, fs.id`,
    [tenantId, studentId, termId]
  );

  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const grossTotal = roundMoney(parseFloat(String(row.gross_total)) || 0);

  const beneficiary: BeneficiaryStudentRow = {
    is_beneficiary: row.is_beneficiary,
    discount_type: row.discount_type,
    discount_value: row.discount_value,
  };
  const adjusted = beneficiaryAdjustedFee(grossTotal, beneficiary);

  return {
    feeStructureId: Number(row.fee_structure_id),
    grossTotal,
    netTotal: roundMoney(adjusted.totalFees),
    discountAmount: roundMoney(adjusted.discountAmount),
  };
}

/**
 * When ledger term_fee / totals are zero but a fee structure exists, fill in expected amounts
 * (same logic as finance statement breakdown).
 */
export async function enrichBalanceShapeWithExpectedFees(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId: number | null,
  shape: StudentBalanceApiShape
): Promise<StudentBalanceApiShape> {
  if (!termId) return shape;

  const ledgerTermFee = roundMoney(shape.currentTermFee ?? 0);
  if (ledgerTermFee > 0) return shape;

  const resolved = await resolveLedgerFeeStructureForStudent(client, tenantId, studentId, termId);
  if (!resolved) return shape;

  const individualCharges = roundMoney(shape.individualCharges ?? 0);
  const arrears = roundMoney(shape.totalArrears ?? 0);
  const totalPaid = roundMoney(shape.totalPaid ?? 0);
  const creditBroughtForward = roundMoney(shape.creditBroughtForward ?? 0);
  const currentTermFee = resolved.netTotal;
  const totalDue = roundMoney(currentTermFee + individualCharges + arrears);
  const netBalance = roundMoney(totalDue - totalPaid - creditBroughtForward);
  const outstanding = roundMoney(Math.max(0, netBalance));

  let status: StudentBalanceApiShape['status'] = 'NotSet';
  if (netBalance < -0.001) status = 'Credit';
  else if (outstanding > 0.001) status = 'Owing';
  else if (totalDue > 0 || totalPaid > 0) status = 'Cleared';
  else if (resolved.grossTotal >= 0) status = 'Cleared';

  const label = shape.currentTermName || 'Current term';

  return {
    ...shape,
    currentTermFee,
    totalDue,
    outstanding,
    netBalance,
    status,
    totalCharged: totalDue,
    discountAmount: resolved.discountAmount > 0 ? resolved.discountAmount : shape.discountAmount,
    termRows: [
      {
        termId,
        termName: label,
        termFee: currentTermFee,
        amountPaid: totalPaid,
        outstanding,
        displayOutstanding: outstanding,
        isActiveTerm: true,
      },
    ],
  };
}
