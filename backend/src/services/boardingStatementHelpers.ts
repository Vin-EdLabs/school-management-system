export type BoardingAmountBreakdown = {
  lodging: number;
  feeding: number;
  total: number;
};

export type BoardingStatementLine = {
  label: string;
  amount: number;
  status?: 'paid' | 'partial' | 'unpaid';
};

/** Statement lines mirror ledger boarding charges (already net of void entries). */
export async function resolveBoardingStatementDisplay(
  _tenantId: number,
  _studentId: number,
  _termId: number,
  rawBoarding: BoardingAmountBreakdown,
  _opts: { boardingModuleEnabled: boolean; isCurrentTerm: boolean }
): Promise<{ lines: BoardingStatementLine[]; billableTotal: number }> {
  if (rawBoarding.total <= 0) {
    return { lines: [], billableTotal: 0 };
  }

  const lines: BoardingStatementLine[] = [];
  if (rawBoarding.lodging > 0) {
    lines.push({ label: 'Boarding — Lodging', amount: rawBoarding.lodging });
  }
  if (rawBoarding.feeding > 0) {
    lines.push({ label: 'Boarding — Feeding', amount: rawBoarding.feeding });
  }
  return { lines, billableTotal: rawBoarding.total };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function proportionalPaidBreakdown(
  raw: BoardingAmountBreakdown,
  paidPortion: number
): BoardingAmountBreakdown {
  if (raw.total <= 0 || paidPortion <= 0) {
    return { lodging: 0, feeding: 0, total: 0 };
  }
  const ratio = paidPortion / raw.total;
  const lodging = roundMoney(raw.lodging * ratio);
  const feeding = roundMoney(raw.feeding * ratio);
  return { lodging, feeding, total: roundMoney(lodging + feeding) };
}
