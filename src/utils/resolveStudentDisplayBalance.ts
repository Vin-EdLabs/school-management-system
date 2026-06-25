import type { StudentBalance } from '@/services/studentBalance';
import { resolveFeeStructureId } from '@/services/feeStructureItems';

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
  return (
    (classMatchById || classMatchByName) &&
    (term === currentTerm || term.startsWith(currentTerm) || currentTerm.startsWith(term))
  );
}

function getStructureGrossFee(student: StudentRef, feeStructures: FeeStructureRef[], term: string | null) {
  if (!term || term === 'Not Set') return 0;
  return feeStructures
    .filter((f) => feeStructureMatchesStudent(f, student, term))
    .reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
}

function getBeneficiaryNetFee(student: StudentRef, gross: number) {
  if (!student.isBeneficiary) return gross;
  const type = String(student.discountType ?? '').trim().toLowerCase();
  const value = Number(student.discountValue) || 0;
  if (!type) return 0;
  if (type === 'percentage') return roundMoney(Math.max(0, gross - (gross * Math.min(100, value)) / 100));
  if (type === 'fixed') return roundMoney(Math.max(0, gross - value));
  return gross;
}

function hasFeeStructureForStudent(
  student: StudentRef,
  feeStructures: FeeStructureRef[],
  currentTerm: string | null
) {
  return feeStructures.some((f) => feeStructureMatchesStudent(f, student, currentTerm));
}

/** Merge API/cache ledger balance with fee-structure fallback (mirrors Student Balances table). */
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
  const structureGross = getStructureGrossFee(student, feeStructures, currentTerm);
  const expectedNet = getBeneficiaryNetFee(student, structureGross);
  const feeStructureConfigured = hasFeeStructureForStudent(student, feeStructures, currentTerm);

  if (!balance) {
    const totalDue = expectedNet;
    const outstanding = feeStructureConfigured ? totalDue : 0;
    return {
      currentTermFee: expectedNet,
      arrears: 0,
      totalDue,
      totalPaid: 0,
      outstanding,
      credit: 0,
      status: feeStructureConfigured ? (outstanding > 0 ? 'Owing' : 'Cleared') : 'NotSet',
      feeStructureConfigured,
    };
  }

  const ledgerTermFee = balance.currentTermFee ?? 0;
  const arrears = balance.totalArrears ?? 0;
  const individualCharges = balance.individualCharges ?? 0;
  const totalPaid = balance.totalPaid ?? 0;
  const creditBroughtForward = balance.creditBroughtForward ?? 0;
  const credit = balance.credit ?? 0;
  const currentTermFee = ledgerTermFee > 0 ? ledgerTermFee : expectedNet;
  const totalDue = roundMoney(
    ledgerTermFee > 0 ? balance.totalDue : currentTermFee + individualCharges + arrears
  );
  const netBalance =
    balance.netBalance != null && ledgerTermFee > 0
      ? balance.netBalance
      : roundMoney(totalDue - totalPaid - creditBroughtForward);
  const outstanding =
    balance.outstanding != null && ledgerTermFee > 0
      ? balance.outstanding
      : roundMoney(Math.max(0, netBalance));

  let status: StudentBalance['status'] = balance.status;
  if (balance.status === 'NotSet' && feeStructureConfigured) {
    status = outstanding > 0 ? 'Owing' : 'Cleared';
  } else if (
    !feeStructureConfigured &&
    ledgerTermFee <= 0 &&
    totalDue <= 0 &&
    totalPaid <= 0 &&
    outstanding <= 0
  ) {
    status = 'NotSet';
  }

  return {
    currentTermFee,
    arrears,
    totalDue,
    totalPaid,
    outstanding,
    credit,
    status,
    feeStructureConfigured,
  };
}
