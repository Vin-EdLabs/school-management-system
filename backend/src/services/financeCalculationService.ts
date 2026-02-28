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
 * Calculate fee balance from total_fees and total_paid.
 * Do NOT store results - compute dynamically on each request.
 */
export function calculateFeeBalance(totalFees: number, totalPaid: number): FeeBalanceResult {
  const totalFeesNum = Number(totalFees) || 0;
  const totalPaidNum = Number(totalPaid) || 0;
  const outstanding = totalFeesNum - totalPaidNum;

  let arrears: number;
  let credit: number;
  let status: 'Owing' | 'Cleared' | 'Credit';

  // Arrears = carryover from previous term only. Not the same as outstanding.
  // For current-term view, arrears = 0 unless explicitly carried over (handled by term-change flow).
  arrears = 0;

  if (outstanding > 0) {
    credit = 0;
    status = 'Owing';
  } else if (outstanding === 0) {
    credit = 0;
    status = 'Cleared';
  } else {
    arrears = 0;
    credit = Math.abs(outstanding);
    status = 'Credit';
  }

  return {
    totalFees: totalFeesNum,
    totalPaid: totalPaidNum,
    outstanding,
    arrears,
    credit,
    status,
  };
}
