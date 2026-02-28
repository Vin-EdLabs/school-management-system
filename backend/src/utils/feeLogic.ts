/**
 * Canonical fee calculation logic.
 * ALWAYS use these formulas:
 * total_outstanding = previous_arrears + current_term_fee - existing_credit
 * remaining_balance = total_outstanding - total_paid_this_term
 *
 * If remaining_balance > 0: arrears = remaining_balance, credit = 0, status = "owing"
 * If remaining_balance == 0: arrears = 0, credit = 0, status = "cleared"
 * If remaining_balance < 0: arrears = 0, credit = abs(remaining_balance), status = "credit"
 */

export interface FeeCalculationResult {
  previousArrears: number;
  currentTermFee: number;
  existingCredit: number;
  totalPaidThisTerm: number;
  totalOutstanding: number;
  remainingBalance: number;
  arrears: number;
  credit: number;
  status: 'owing' | 'cleared' | 'credit';
}

export function calculateFeeStatus(
  previousArrears: number,
  currentTermFee: number,
  existingCredit: number,
  totalPaidThisTerm: number
): FeeCalculationResult {
  const totalOutstanding = Math.max(0, previousArrears + currentTermFee - existingCredit);
  const remainingBalance = totalOutstanding - totalPaidThisTerm;

  let arrears: number;
  let credit: number;
  let status: 'owing' | 'cleared' | 'credit';

  if (remainingBalance > 0) {
    arrears = remainingBalance;
    credit = 0;
    status = 'owing';
  } else if (remainingBalance === 0) {
    arrears = 0;
    credit = 0;
    status = 'cleared';
  } else {
    arrears = 0;
    credit = Math.abs(remainingBalance);
    status = 'credit';
  }

  return {
    previousArrears,
    currentTermFee,
    existingCredit,
    totalPaidThisTerm,
    totalOutstanding,
    remainingBalance,
    arrears,
    credit,
    status,
  };
}
