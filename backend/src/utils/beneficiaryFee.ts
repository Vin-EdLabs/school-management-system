/**
 * Central rules for beneficiary / scholarship fee amounts (must match ledger + arrears SQL).
 * If `is_beneficiary` is true but `discount_type` is missing, treat as full fee waiver (common DB state).
 */

export type BeneficiaryStudentRow = {
  is_beneficiary?: boolean | null;
  discount_type?: string | null;
  discount_value?: string | number | null;
};

export function beneficiaryAdjustedFee(
  standardFees: number,
  student: BeneficiaryStudentRow | null | undefined
): { totalFees: number; discountAmount: number } {
  const base = Number(standardFees) || 0;
  if (!student?.is_beneficiary) {
    return { totalFees: base, discountAmount: 0 };
  }
  const typeRaw = student.discount_type;
  const type = String(typeRaw ?? '')
    .trim()
    .toLowerCase();
  const val = parseFloat(String(student.discount_value ?? '0')) || 0;

  if (!type) {
    return { totalFees: 0, discountAmount: base };
  }
  if (type === 'percentage') {
    const pct = Math.min(100, Math.max(0, val));
    const discountAmount = (base * pct) / 100;
    return { totalFees: Math.max(0, base - discountAmount), discountAmount };
  }
  if (type === 'fixed') {
    const discountAmount = Math.min(base, val);
    return { totalFees: Math.max(0, base - val), discountAmount };
  }
  return { totalFees: 0, discountAmount: base };
}

/** Human-readable label for invoice / statement discount lines. */
export function formatBeneficiaryDiscountLabel(student: BeneficiaryStudentRow | null | undefined): string {
  if (!student?.is_beneficiary) return 'Beneficiary Discount';
  const type = String(student.discount_type ?? '')
    .trim()
    .toLowerCase();
  if (!type) return 'Beneficiary Discount (100%)';
  if (type === 'percentage') return `Beneficiary Discount (${student.discount_value}%)`;
  if (type === 'fixed') return `Beneficiary Discount (GHS ${student.discount_value})`;
  return 'Beneficiary Discount';
}

/** Used when deciding whether to carry ledger balance into the next term. */
export function isFullFeeWaiverStudentRow(student: BeneficiaryStudentRow | null | undefined): boolean {
  if (!student?.is_beneficiary) return false;
  const type = String(student.discount_type ?? '')
    .trim()
    .toLowerCase();
  const val = parseFloat(String(student.discount_value ?? '0')) || 0;
  if (!type) return true;
  if (type === 'percentage' && val >= 100) return true;
  return false;
}

/**
 * SQL fragment: net fee amount from column expression (e.g. `fs.total` or `fs.amount`) given joined student `s`.
 * Keep in sync with beneficiaryAdjustedFee().
 */
export function sqlBeneficiaryAdjustedAmount(colExpr: string): string {
  return `
CASE
  WHEN s.is_beneficiary = true
    AND (s.discount_type IS NULL OR TRIM(COALESCE(s.discount_type::text, '')) = '')
    THEN 0::numeric
  WHEN s.is_beneficiary = true AND LOWER(TRIM(s.discount_type::text)) = 'percentage'
    THEN GREATEST(0::numeric, ${colExpr}::numeric - (${colExpr}::numeric * COALESCE(s.discount_value, 0)::numeric / 100))
  WHEN s.is_beneficiary = true AND LOWER(TRIM(s.discount_type::text)) = 'fixed'
    THEN GREATEST(0::numeric, ${colExpr}::numeric - COALESCE(s.discount_value, 0)::numeric)
  ELSE ${colExpr}::numeric
END`;
}

/** @deprecated Prefer SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE from feeStructureSql.ts */
export const SQL_BENEFICIARY_TERM_FEE_DEBIT = sqlBeneficiaryAdjustedAmount('fs.total');
