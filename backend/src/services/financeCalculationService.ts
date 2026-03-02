/**
 * Finance Calculation Service
 * Follows proper accounting rules. All balances are computed dynamically - never stored.
 *
 * Formulas:
 *   total_fees = SUM(assigned_amount) from fee_structure per class, term, academic_year
 *   total_paid = SUM(payments.amount) for student, term, academic_year
 *   outstanding = total_fees - total_paid
 *
 * Arrears = carryover from PREVIOUS term only. For new students or current-term-only view, arrears = 0.
 * Arrears is NOT the same as outstanding - it is only set when term/class promotion carries forward unpaid balance.
 *
 * Status logic:
 *   IF outstanding > 0:  arrears = 0 (or carryover if tracked), credit = 0, status = "Owing"
 *   IF outstanding == 0: arrears = 0, credit = 0, status = "Cleared"
 *   IF outstanding < 0:  arrears = 0, credit = ABS(outstanding), status = "Credit"
 */

export interface FeeBalanceResult {
  totalFees: number;
  totalPaid: number;
  outstanding: number;
  arrears: number;
  credit: number;
  status: 'Owing' | 'Cleared' | 'Credit';
}

/**
 * Calculate fee balance from total_fees, total_paid, and arrears.
 * Do NOT store results - compute dynamically on each request.
 */
export function calculateFeeBalance(totalFees: number, totalPaid: number, arrears: number = 0): FeeBalanceResult {
  const totalFeesNum = Number(totalFees) || 0;
  const totalPaidNum = Number(totalPaid) || 0;
  const arrearsNum = Number(arrears) || 0;

  const totalAmountDue = totalFeesNum + arrearsNum;
  const outstanding = totalAmountDue - totalPaidNum;

  let credit: number;
  let status: 'Owing' | 'Cleared' | 'Credit';

  if (outstanding > 0) {
    credit = 0;
    status = 'Owing';
  } else if (outstanding === 0) {
    credit = 0;
    status = 'Cleared';
  } else {
    credit = Math.abs(outstanding);
    status = 'Credit';
  }

  return {
    totalFees: totalFeesNum,
    totalPaid: totalPaidNum,
    outstanding,
    arrears: arrearsNum,
    credit,
    status,
  };
}
