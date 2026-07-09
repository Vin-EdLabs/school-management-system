import type { StudentBalance } from '@/services/studentBalance';

type FeeStructureRef = {
  id: string;
  classId?: number;
  class_id?: number;
  className?: string;
  class_name?: string;
  term?: string;
  amount?: number;
};

type StudentRef = {
  id: string | number;
  classAssigned?: string;
  classAssignedId?: number | string | null;
  isBeneficiary?: boolean;
  discountType?: string;
  discountValue?: number;
};

const roundMoney = (n: number) => Math.round(n * 100) / 100;

const normalizeClassName = (name: string) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

function feeStructureMatchesStudent(
  fee: FeeStructureRef,
  student: StudentRef,
  currentTerm: string | null
) {
  if (!currentTerm || currentTerm === 'Not Set') return false;
  const feeClassId = fee.classId ?? fee.class_id;
  const feeClassName = fee.className ?? fee.class_name ?? '';
  const studentClassName = student.classAssigned ?? '';
  const classMatchById =
    student.classAssignedId != null &&
    feeClassId != null &&
    Number(feeClassId) === Number(student.classAssignedId);
  const classMatchByName =
    normalizeClassName(feeClassName) !== '' &&
    normalizeClassName(feeClassName) === normalizeClassName(studentClassName);
  const term = String(fee.term || '').trim();
  const normTerm = currentTerm.trim();
  const termMatch =
    !term ||
    term === normTerm ||
    term.startsWith(normTerm) ||
    normTerm.startsWith(term) ||
    normTerm.replace(/\s+\d{4}(\/\d{4})?$/, '').trim() === term.replace(/\s+\d{4}(\/\d{4})?$/, '').trim();
  return (classMatchById || classMatchByName) && termMatch;
}

function hasFeeStructureForStudent(
  student: StudentRef,
  feeStructures: FeeStructureRef[],
  currentTerm: string | null
) {
  return feeStructures.some((f) => feeStructureMatchesStudent(f, student, currentTerm));
}

/** Ledger-only display amounts — no unbilled fee-structure preview. */
export function resolveStudentDisplayBalance(
  student: StudentRef,
  balance: StudentBalance | undefined | null,
  feeStructures: FeeStructureRef[],
  currentTerm: string | null
): {
  currentTermFee: number;
  arrears: number;
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  credit: number;
  status: StudentBalance['status'];
  feeStructureConfigured: boolean;
} {
  const feeStructureConfigured = hasFeeStructureForStudent(student, feeStructures, currentTerm);

  if (!balance) {
    return {
      currentTermFee: 0,
      arrears: 0,
      totalDue: 0,
      totalPaid: 0,
      outstanding: 0,
      credit: 0,
      status: 'NotSet',
      feeStructureConfigured,
    };
  }

  const ledgerTermFee = balance.currentTermFee ?? 0;
  const arrears = balance.totalArrears ?? 0;
  const individualCharges = balance.individualCharges ?? 0;
  const totalPaid = balance.totalPaid ?? 0;
  const creditBroughtForward = balance.creditBroughtForward ?? 0;
  const credit = balance.credit ?? 0;
  const currentTermFee = ledgerTermFee;

  const ledgerTotalDue = balance.totalDue ?? 0;
  const totalDue = roundMoney(
    ledgerTotalDue > 0 ? ledgerTotalDue : currentTermFee + individualCharges + arrears
  );

  const netBalance = roundMoney(totalDue - totalPaid - creditBroughtForward);
  const computedOutstanding = roundMoney(Math.max(0, netBalance));
  const apiOutstanding = balance.outstanding ?? 0;
  const outstanding = roundMoney(
    Math.max(computedOutstanding, apiOutstanding > 0 ? apiOutstanding : 0)
  );
  const displayCredit = netBalance < -0.001 ? roundMoney(Math.abs(netBalance)) : credit;

  let status: StudentBalance['status'] = balance.status;
  if (
    ledgerTermFee <= 0 &&
    totalDue <= 0 &&
    totalPaid <= 0 &&
    outstanding <= 0 &&
    arrears <= 0
  ) {
    status = 'NotSet';
  } else if (outstanding > 0 && balance.status === 'Cleared') {
    status = 'Owing';
  }

  return {
    currentTermFee,
    arrears,
    totalDue,
    totalPaid,
    outstanding,
    credit: displayCredit,
    status,
    feeStructureConfigured,
  };
}
