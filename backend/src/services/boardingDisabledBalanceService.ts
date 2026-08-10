import type { StudentBalanceApiShape } from './ledgerBalanceService.js';

/**
 * Finance totals come from student_ledger (net of void entries).
 * Toggling boarding OFF does not change displayed term bills — only explicit
 * void/refund actions on the ledger do. Paid boarding always remains visible.
 */
export async function applyBoardingDisabledToBalanceShape(
  _tenantId: number,
  _studentId: number,
  _termId: number | null,
  shape: StudentBalanceApiShape
): Promise<StudentBalanceApiShape> {
  return shape;
}
