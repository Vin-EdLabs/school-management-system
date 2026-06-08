import { formatDisplayDate } from './dateFormat';


import { apiService } from '../services/api';

export interface FeeCalculation {
  totalFee: number;
  arrears: number;
  creditBalance: number;
  totalAmountDue: number;
  totalPaid: number;
  currentTermFee: number;
  baseFee?: number;
  discountAmount?: number;
}

export interface StudentPaymentRecord {
  studentId: string;
  term: string;
  amount: number;
  date: string;
  paymentMethod: string;
  notes?: string;
}

export interface StudentFeeStatus {
  status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Fully Paid' | 'Amount Owing' | 'Credit Balance' | 'No Fee Set';
  balance: number;
}

export const generateReceiptNumber = (): string => {
  const prefix = 'RGS';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
};

export const getSchoolSettings = () => {
  const defaultSettings = {
    name: 'School',
    address: '',
    contact: '',
    email: ''
  };
  
  const savedSettings = localStorage.getItem('schoolInfo');
  if (savedSettings) {
    try {
      return { ...defaultSettings, ...JSON.parse(savedSettings) };
    } catch (error) {
      console.error('Error loading school settings:', error);
    }
  }
  return defaultSettings;
};

// Cache updated by ActiveTermContext - fallback when used outside React tree
let _cachedTerm = 'Not Set';
let _cachedYear = new Date().getFullYear().toString();

export const setActiveTermCache = (term: string, year: string) => {
  _cachedTerm = term;
  _cachedYear = year;
};

export const getActiveAcademicTerm = () => _cachedTerm;

export const getActiveAcademicYear = () => _cachedYear;

/**
 * `current_year` in settings may be a calendar year ("2026") or an academic span ("2025/2026").
 * Use this for dashboard filters so income/expense rows from the DB are not dropped.
 */
export function dateMatchesAcademicYearSetting(date: Date, academicYearSetting: string): boolean {
  const y = date.getFullYear();
  const s = (academicYearSetting || '').trim();
  if (!s) return true;
  if (/^\d{4}$/.test(s)) return y === parseInt(s, 10);
  const span = s.match(/^(\d{4})\s*[/\\-]\s*(\d{4})\s*$/);
  if (span) {
    const y1 = parseInt(span[1], 10);
    const y2 = parseInt(span[2], 10);
    if (!Number.isFinite(y1) || !Number.isFinite(y2)) return String(y) === s;
    return y === y1 || y === y2;
  }
  const head = parseInt(s.slice(0, 4), 10);
  if (!Number.isNaN(head) && /^\d{4}/.test(s)) return y === head;
  return String(y) === s;
}

/** Single calendar year for Jan–Dec charts when the setting is an academic span. */
export function getDashboardCalendarYearForMonthlyChart(academicYearSetting: string): string {
  const s = (academicYearSetting || '').trim();
  if (/^\d{4}$/.test(s)) return s;
  const span = s.match(/^(\d{4})\s*[/\\-]\s*(\d{4})\s*$/);
  if (span) {
    const y1 = parseInt(span[1], 10);
    const y2 = parseInt(span[2], 10);
    const nowY = new Date().getFullYear();
    if (nowY === y1 || nowY === y2) return String(nowY);
    return String(Math.max(y1, y2));
  }
  const head = parseInt(s.slice(0, 4), 10);
  if (!Number.isNaN(head) && /^\d{4}/.test(s)) return String(head);
  return String(new Date().getFullYear());
}

/** Align with backend `beneficiaryAdjustedFee`: missing discount type on a beneficiary = full waiver. */
function applyBeneficiaryToBaseFee(
  baseTermFee: number,
  info?: { isBeneficiary?: boolean; discountType?: string; discountValue?: number }
): { currentTermFee: number; discountAmount: number } {
  const base = Number(baseTermFee) || 0;
  if (!info?.isBeneficiary) return { currentTermFee: base, discountAmount: 0 };
  const type = String(info.discountType ?? '')
    .trim()
    .toLowerCase();
  const val = Number(info.discountValue) || 0;
  if (!type) return { currentTermFee: 0, discountAmount: base };
  if (type === 'percentage') {
    const pct = Math.min(100, Math.max(0, val));
    const discountAmount = (base * pct) / 100;
    return { currentTermFee: Math.max(0, base - discountAmount), discountAmount };
  }
  if (type === 'fixed') {
    const discountAmount = Math.min(base, val);
    return { currentTermFee: Math.max(0, base - val), discountAmount };
  }
  return { currentTermFee: 0, discountAmount: base };
}

export const calculateStudentFees = async (
  studentId: string,
  currentTerm: string,
  studentClass: string,
  feeStructures: any[],
  payments: any[],
  academicYear?: string
): Promise<FeeCalculation> => {
  try {
    // Try to get from backend API first
    const year = academicYear || getActiveAcademicYear();
    const termParts = currentTerm.split(' ');
    const term = termParts.slice(0, -1).join(' '); // Remove year part
    
    const response: any = await apiService.get(
      `/fee-calculations/student/${studentId}?term=${encodeURIComponent(term)}&academicYear=${year}`
    );
    
    if (response && response.feeCalculation) {
      const fc = response.feeCalculation;
      return {
        totalFee: fc.totalFees ?? fc.currentTermFee ?? 0,
        arrears: fc.arrears ?? 0,
        creditBalance: fc.credit ?? fc.creditBalance ?? 0,
        totalAmountDue: fc.totalFees ?? fc.totalAmountDue ?? fc.currentTermFee ?? 0,
        totalPaid: fc.totalPaid ?? 0,
        currentTermFee: fc.totalFees ?? fc.currentTermFee ?? 0,
      };
    }
  } catch (error) {
    console.warn('Backend fee calculation failed, using fallback:', error);
  }
  
  // Fallback to local calculation if backend fails
  const syncResult = calculateStudentFeesSync(
    studentId,
    currentTerm,
    studentClass,
    feeStructures || [],
    payments || []
  );
  const currentTermFee = syncResult.currentTermFee;
  const currentTermPayments = syncResult.totalPaid;

  return {
    totalFee: currentTermFee,
    arrears: 0,
    creditBalance: 0,
    totalAmountDue: currentTermFee,
    totalPaid: currentTermPayments,
    currentTermFee: currentTermFee
  };
};

/** Check if two terms match (e.g. "Term 1" matches "Term 1 2024" and vice versa) */
export function termsMatch(term1: string | undefined, term2: string | undefined): boolean {
  if (!term1 || !term2) return false;
  if (term1 === term2) return true;
  return term1.includes(term2) || term2.includes(term1);
}

/** Persisted on each payment when recorded — balance line must never change for old receipts. */
export type ReceiptSnapshotData = {
  totalDue: number;
  termFee: number;
  arrears: number;
  balanceAfter: number;
  credit?: number;
};

export function parseReceiptSnapshot(raw: unknown): ReceiptSnapshotData | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return parseReceiptSnapshot(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.balanceAfter !== 'number' && typeof o.balanceAfter !== 'string') return null;
  return {
    totalDue: Number(o.totalDue ?? 0),
    termFee: Number(o.termFee ?? 0),
    arrears: Number(o.arrears ?? 0),
    balanceAfter: Math.max(0, Number(o.balanceAfter ?? 0)),
    credit: Number(o.credit ?? 0),
  };
}

/**
 * Receipt totals: prefer DB snapshot; else estimate from cumulative paid up to this payment (same term).
 */
export function receiptAmountsForPayment(
  payment: {
    id: string;
    studentId: string;
    studentIdNum?: number;
    amount: number;
    term: string;
    date: string;
    receiptSnapshot?: unknown;
    receipt_snapshot?: unknown;
  },
  allPayments: { id: string; studentId: string; studentIdNum?: number; amount: number; term: string; date: string }[],
  student: {
    classAssigned: string;
    classAssignedId?: number | string | null;
    isBeneficiary?: boolean;
    discountType?: string;
    discountValue?: number;
  },
  feeStructures: any[],
  arrearsBalances?: Record<string, number> | null
): { remainingBalance: number; totalAmountDue: number; currentTermFee: number; arrears: number; creditBalance: number } {
  const snap = parseReceiptSnapshot(payment.receiptSnapshot ?? payment.receipt_snapshot);
  if (snap) {
    return {
      remainingBalance: snap.balanceAfter,
      totalAmountDue: snap.totalDue,
      currentTermFee: snap.termFee,
      arrears: snap.arrears,
      creditBalance: Math.max(0, snap.credit || 0),
    };
  }

  const termForCalc = (payment.term || '').trim() || 'Not Set';
  const feeDetails = calculateStudentFeesSync(
    payment.studentId,
    termForCalc,
    student.classAssigned,
    feeStructures,
    allPayments,
    student.classAssignedId ?? undefined,
    arrearsBalances,
    {
      isBeneficiary: !!student.isBeneficiary,
      discountType: student.discountType,
      discountValue: student.discountValue,
    }
  );

  const sameStudent = (p: { studentId: string; studentIdNum?: number }) =>
    String(p.studentId) === String(payment.studentId) || String(p.studentIdNum ?? '') === String(payment.studentId);

  const chronological = [...allPayments]
    .filter((p) => sameStudent(p) && termsMatch(termForCalc, p.term))
    .sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      if (ta !== tb) return ta - tb;
      return Number(a.id) - Number(b.id);
    });

  let cumulative = 0;
  for (const p of chronological) {
    cumulative += Number(p.amount) || 0;
    if (String(p.id) === String(payment.id)) break;
  }

  return {
    remainingBalance: Math.max(0, feeDetails.totalAmountDue - cumulative),
    totalAmountDue: feeDetails.totalAmountDue,
    currentTermFee: feeDetails.currentTermFee,
    arrears: feeDetails.arrears,
    creditBalance: Math.max(0, cumulative - feeDetails.totalAmountDue),
  };
}

/** Sync version - Matches backend: total_outstanding = previous_arrears + current_term_fee, remaining = total_outstanding - total_paid */
export const calculateStudentFeesSync = (
  studentId: string,
  currentTerm: string,
  studentClass: string,
  feeStructures: any[],
  payments: any[],
  studentClassId?: number | string | null,
  arrearsBalances?: Record<string, number> | null,
  studentBeneficiaryInfo?: { isBeneficiary: boolean; discountType?: string; discountValue?: number }
): FeeCalculation => {
  if (!currentTerm || currentTerm === 'Not Set') {
    return { totalFee: 0, arrears: 0, creditBalance: 0, totalAmountDue: 0, totalPaid: 0, currentTermFee: 0 };
  }
  const classMatch = (fee: any) => {
    if (studentClassId != null && fee.class_id != null) return Number(fee.class_id) === Number(studentClassId);
    if (fee.classId != null && studentClassId != null) return Number(fee.classId) === Number(studentClassId);
    const cn = (fee.class_name || fee.className || '').trim();
    const sc = (studentClass || '').trim();
    return cn === sc || cn.includes(sc) || sc.includes(cn);
  };
  // Legacy DB rows may have missing term; treat them as current term
  // so newly set fees still bill students without manual migration.
  const termMatch = (t: string | undefined) => !t || termsMatch(currentTerm, t);
  const matchingFees = (feeStructures || []).filter((fee: any) => classMatch(fee) && termMatch(fee.term));
  const baseTermFee = matchingFees.reduce((sum: number, f: any) => sum + (parseFloat(f.amount) || 0), 0);
  const { currentTermFee } = applyBeneficiaryToBaseFee(baseTermFee, studentBeneficiaryInfo);

  const previousArrears = Math.max(
    0,
    arrearsBalances && arrearsBalances[studentId] ? arrearsBalances[studentId] : 0
  );
  const totalPaid = (payments || [])
    .filter((p: any) => {
      const matchById = String(p.studentId) === String(studentId) || String(p.studentIdNum) === String(studentId);
      return matchById && termMatch(p.term);
    })
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  const totalAmountDue = Math.max(0, previousArrears + currentTermFee);
  const remainingBalance = totalAmountDue - totalPaid;
  // Arrears = carryover from previous term only, NOT the full balance
  const arrears = previousArrears;
  return {
    totalFee: currentTermFee,
    arrears,
    creditBalance: remainingBalance < 0 ? Math.abs(remainingBalance) : 0,
    totalAmountDue,
    totalPaid,
    currentTermFee,
    baseFee: baseTermFee,
    discountAmount: baseTermFee - currentTermFee
  };
};

/** Sync fee status from fee calculation */
export const calculateStudentFeeStatusSync = (
  feeCalculation: FeeCalculation
): StudentFeeStatus => {
  if (feeCalculation.currentTermFee === 0) {
    return { status: 'No Fee Set', balance: 0 };
  }
  const totalAmountDue = feeCalculation.totalAmountDue ?? feeCalculation.currentTermFee;
  const totalPaid = feeCalculation.totalPaid ?? 0;
  const balance = Math.max(0, totalAmountDue - totalPaid);
  if (totalPaid > totalAmountDue) return { status: 'Credit Balance', balance: -(totalPaid - totalAmountDue) };
  if (totalPaid >= totalAmountDue) return { status: 'Paid', balance: 0 };
  if (totalPaid > 0 && totalPaid < totalAmountDue) return { status: 'Partially Paid', balance };
  return { status: 'Unpaid', balance };
};

export const calculateStudentFeeStatus = async (
  studentId: string,
  currentTerm: string,
  students: any[],
  feeStructures: any[],
  payments: any[],
  academicYear?: string
): Promise<StudentFeeStatus> => {
  const student = students.find(s => s.id === studentId);
  if (!student) {
    return { status: 'No Fee Set', balance: 0 };
  }

  const feeCalculation = await calculateStudentFees(
    studentId,
    currentTerm,
    student.classAssigned,
    feeStructures,
    payments,
    academicYear
  );

  // If no fee structure is set for this class/term
  if (feeCalculation.currentTermFee === 0) {
    return { status: 'No Fee Set', balance: 0 };
  }

  const balance = feeCalculation.totalAmountDue - feeCalculation.totalPaid;

  if (balance <= 0) {
    if (feeCalculation.creditBalance > 0) {
      return { status: 'Credit Balance', balance: -feeCalculation.creditBalance };
    }
    return { status: 'Fully Paid', balance: 0 };
  } else {
    return { status: 'Amount Owing', balance: balance };
  }
};

export const processArrearsForTermChange = async (
  previousTerm: string,
  newTerm: string,
  academicYear: string
) => {
  try {
    const termParts = previousTerm.split(' ');
    const prevTerm = termParts.slice(0, -1).join(' ');
    const newTermParts = newTerm.split(' ');
    const newTermName = newTermParts.slice(0, -1).join(' ');
    
    const response: any = await apiService.post('/fee-calculations/process-term-change', {
      previousTerm: prevTerm,
      newTerm: newTermName,
      academicYear,
    });
    
    return response;
  } catch (error) {
    console.error('Failed to process term change:', error);
    throw error;
  }
};

// Function to handle class promotion with fee calculations
export const processFeesForClassPromotion = async (
  studentId: string,
  oldClassId: number,
  newClassId: number,
  currentTerm: string,
  academicYear: string
) => {
  try {
    const response: any = await apiService.post('/fee-calculations/process-class-promotion', {
      studentId: parseInt(studentId),
      oldClassId,
      newClassId,
      currentTerm,
      academicYear,
    });
    
    return response.outstandingCarriedOver || 0;
  } catch (error) {
    console.error('Failed to process class promotion fees:', error);
    return 0;
  }
};

// Function to get receipt header information
export const getReceiptHeader = (term?: string) => {
  const schoolSettings = getSchoolSettings();
  const activeTerm = term || getActiveAcademicTerm();
  const activeYear = getActiveAcademicYear();
  
  return {
    schoolName: schoolSettings.name,
    schoolAddress: schoolSettings.address,
    schoolContact: schoolSettings.contact,
    schoolEmail: schoolSettings.email,
    term: activeTerm,
    year: activeYear,
    generatedDate: formatDisplayDate(new Date()),
    generatedTime: new Date().toLocaleTimeString()
  };
};
