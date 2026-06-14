/** Signed net position: positive = student owes, negative = student has credit. */
export function signedNetOwed(outstanding: number, credit: number): number {
  if (outstanding > 0.0001) return outstanding;
  if (credit > 0.0001) return -credit;
  return 0;
}

export function formatCorrectionGhs(amount: number): string {
  return `GHS ${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Current balance label for the modal header and preview. */
export function getCurrentBalanceDisplay(outstanding: number, credit: number, totalDue = 0) {
  const signed = signedNetOwed(outstanding, credit);
  const owing = Math.max(0, signed);
  const genuineOverpayment = signed < -0.0001 && totalDue > 0.0001;

  if (genuineOverpayment) {
    return {
      kind: 'overpayment' as const,
      label: 'Current overpayment',
      amount: Math.abs(signed),
      formatted: formatCorrectionGhs(Math.abs(signed)),
    };
  }
  return {
    kind: 'outstanding' as const,
    label: 'Current outstanding balance',
    amount: owing,
    formatted: formatCorrectionGhs(owing),
  };
}

function outstandingDisplayAmount(outstanding: number, credit: number): number {
  return Math.max(0, signedNetOwed(outstanding, credit));
}

export type CorrectionPreviewCopy = {
  headline: string;
  balanceLine: string;
  extraLine?: string;
};

/** User-facing preview copy for credit and debit corrections. */
export function buildCorrectionPreviewCopy(
  correctionType: 'debit' | 'credit',
  currentOutstanding: number,
  currentCredit: number,
  projected: CorrectionBalanceProjection
): CorrectionPreviewCopy {
  const beforeOutstanding = outstandingDisplayAmount(currentOutstanding, currentCredit);
  const changeAmount =
    correctionType === 'credit' ? projected.oweLess : projected.oweMore;

  if (correctionType === 'credit') {
    const afterOutstanding = Math.max(0, projected.outstanding);
    const overpayment = projected.credit > 0.0001 ? projected.credit : 0;
    const fullyPaid = afterOutstanding <= 0.0001 && overpayment <= 0.0001;

    const headline =
      changeAmount > 0.0001
        ? `After this credit correction the student's outstanding balance will decrease by ${formatCorrectionGhs(changeAmount)}`
        : '';

    let extraLine: string | undefined;
    if (fullyPaid) {
      extraLine = 'Student will be fully paid up after this correction';
    } else if (overpayment > 0.0001) {
      extraLine = `This will result in an overpayment of ${formatCorrectionGhs(overpayment)} for this student`;
    }

    const balanceLine = `Outstanding balance: ${formatCorrectionGhs(beforeOutstanding)} → ${formatCorrectionGhs(afterOutstanding)}`;

    return { headline, balanceLine, extraLine };
  }

  const afterOutstanding = Math.max(0, projected.outstanding);
  const headline =
    changeAmount > 0.0001
      ? `After this debit correction the student's outstanding balance will increase by ${formatCorrectionGhs(changeAmount)}`
      : '';
  const balanceLine = `Outstanding balance: ${formatCorrectionGhs(beforeOutstanding)} → ${formatCorrectionGhs(afterOutstanding)}`;

  return { headline, balanceLine };
}

export function validateCorrectionTypeAmount(
  correctionType: 'debit' | 'credit',
  originalAmount: number,
  newAmount: number
): string | null {
  if (correctionType === 'debit' && newAmount >= originalAmount - 0.0001) {
    return 'Debit correction must have a lower amount than the original';
  }
  if (correctionType === 'credit' && newAmount <= originalAmount + 0.0001) {
    return 'Credit correction must have a higher amount than the original';
  }
  return null;
}

export type CorrectionBalanceProjection = {
  /** Outstanding amount owed after correction (>= 0). */
  outstanding: number;
  /** Credit balance after correction (>= 0). */
  credit: number;
  /** Positive when outstanding balance will increase; zero for credit corrections. */
  oweMore: number;
  /** Positive when outstanding balance will decrease; zero for debit corrections. */
  oweLess: number;
  signedBefore: number;
  signedAfter: number;
};

/**
 * Credit: balance after = current balance − (new − original) — student owes less.
 * Debit:  balance after = current balance + (original − new) — student owes more.
 *
 * Works on signed net owed (positive = owing, negative = credit).
 */
export function projectBalanceAfterCorrection(
  currentOutstanding: number,
  currentCredit: number,
  originalAmount: number,
  newAmount: number,
  correctionType: 'debit' | 'credit'
): CorrectionBalanceProjection {
  const signedBefore = signedNetOwed(currentOutstanding, currentCredit);

  const oweLess = correctionType === 'credit' ? Math.max(0, newAmount - originalAmount) : 0;
  const oweMore = correctionType === 'debit' ? Math.max(0, originalAmount - newAmount) : 0;

  const signedAfter =
    correctionType === 'credit'
      ? signedBefore - (newAmount - originalAmount)
      : signedBefore + (originalAmount - newAmount);

  return {
    outstanding: Math.max(0, signedAfter),
    credit: signedAfter < -0.0001 ? Math.abs(signedAfter) : 0,
    oweMore,
    oweLess,
    signedBefore,
    signedAfter,
  };
}
