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

const FEE_STRUCTURE_SELECT = `
  SELECT DISTINCT ON (s.id)
    fs.id AS fee_structure_id,
    (${SQL_EFFECTIVE_FEE_STRUCTURE_TOTAL}) AS gross_total,
    s.is_beneficiary,
    s.discount_type,
    s.discount_value
  FROM students s
  LEFT JOIN classes c_student ON c_student.id = s.class_assigned_id AND c_student.tenant_id = s.tenant_id
  INNER JOIN terms t ON t.id = $3 AND t.tenant_id = s.tenant_id
  INNER JOIN ledger_fee_structures fs ON fs.tenant_id = s.tenant_id
    AND fs.term_id = t.id
    AND fs.academic_year_id = t.academic_year_id
    AND ${SQL_FEE_STRUCTURE_CLASS_MATCH}
  INNER JOIN classes c_fs ON c_fs.id = fs.class_id AND c_fs.tenant_id = fs.tenant_id
  WHERE s.tenant_id = $1
    AND s.id = $2
  ORDER BY s.id, (fs.class_id = s.class_assigned_id) DESC, fs.id
`;

function mapResolvedRow(row: Record<string, unknown>): ResolvedStudentFeeStructure {
  const grossTotal = roundMoney(parseFloat(String(row.gross_total)) || 0);
  const beneficiary: BeneficiaryStudentRow = {
    is_beneficiary: row.is_beneficiary as boolean | null,
    discount_type: row.discount_type as string | null,
    discount_value: row.discount_value as string | number | null,
  };
  const adjusted = beneficiaryAdjustedFee(grossTotal, beneficiary);
  return {
    feeStructureId: Number(row.fee_structure_id),
    grossTotal,
    netTotal: roundMoney(adjusted.totalFees),
    discountAmount: roundMoney(adjusted.discountAmount),
  };
}

/** Find fee structure for a student in a term (class id or normalized class name). */
export async function resolveLedgerFeeStructureForStudent(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId: number
): Promise<ResolvedStudentFeeStructure | null> {
  const run: QueryFn = client ? client.query.bind(client) : query;
  const res = await run(FEE_STRUCTURE_SELECT, [tenantId, studentId, termId]);
  if (res.rows.length === 0) return null;
  return mapResolvedRow(res.rows[0]);
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
  const ledgerOutstanding = roundMoney(shape.outstanding ?? 0);
  const needsEnrichment =
    ledgerTermFee <= 0 &&
    (shape.status === 'NotSet' || ledgerOutstanding <= 0) &&
    (shape.totalDue ?? 0) <= 0;

  if (!needsEnrichment && ledgerTermFee > 0) return shape;

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

/** Verify student belongs to tenant before returning balance data. */
export async function assertStudentInTenant(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number
): Promise<boolean> {
  const run: QueryFn = client ? client.query.bind(client) : query;
  const res = await run(
    `SELECT 1 FROM students WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [studentId, tenantId]
  );
  return res.rows.length > 0;
}
