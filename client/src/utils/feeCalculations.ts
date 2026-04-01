
export interface FeeCalculation {
  totalFee: number;
  arrears: number;
  creditBalance: number;
  totalAmountDue: number;
  totalPaid: number;
  currentTermFee: number;
  remainingBalance: number;
  matchedFeeStructure?: any;
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
  status: 'Fully Paid' | 'Amount Owing' | 'Credit Balance' | 'No Fee Set';
  balance: number;
}

export const generateReceiptNumber = (): string => {
  const prefix = 'RGS';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
};

export const getSchoolSettings = (savedSettings?: any) => {
  const defaultSettings = {
    name: 'Rosa Gardens School',
    address: 'Accra, Ghana',
    contact: '+233 XX XXX XXXX',
    email: 'info@rosagardens.edu.gh'
  };

  if (savedSettings) {
    return { ...defaultSettings, ...savedSettings };
  }
  return defaultSettings;
};

export const getActiveAcademicTerm = (terms?: any[]) => {
  if (terms && Array.isArray(terms)) {
    const activeTerm = terms.find((term: any) => term.isActive || term.is_active);
    return activeTerm ? `${activeTerm.name}` : 'Term 1';
  }
  return 'Term 1 2024';
};

export const getActiveAcademicYear = (terms?: any[]) => {
  if (terms && Array.isArray(terms)) {
    const activeTerm = terms.find((term: any) => term.isActive || term.is_active);
    return activeTerm ? activeTerm.year : '2024';
  }
  return '2024';
};

export const calculateStudentFees = (
  studentId: string,
  currentTerm: any, // Can be string (name) or object { name, id }
  studentClass: string,
  feeStructures: any[],
  payments: any[],
  arrearsData?: Record<string, number>,
  creditData?: Record<string, number>
): FeeCalculation => {
  // Extract term info
  const termName = typeof currentTerm === 'object' ? currentTerm?.name : currentTerm;
  const termId = typeof currentTerm === 'object' ? currentTerm?.id : null;

  // Helper to extract level from a class name (strip stream/section)
  const extractLevel = (name: string) => {
    if (!name) return name;
    const sepIndex = name.search(/[-\/|:]/);
    if (sepIndex > -1) return name.slice(0, sepIndex).trim();
    const parts = name.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    if (/^[A-Za-z]$/.test(last) || (/^[0-9]+[A-Za-z]?$/.test(last) && /[A-Za-z]/.test(last))) {
      return parts.slice(0, -1).join(' ');
    }
    return name;
  };

  // Flexible matching: try exact class+term, then level fallback
  const normalize = (v: any) => (v ?? '').toString().trim().toLowerCase();
  const studentClassNorm = normalize(studentClass);
  const termNorm = normalize(termName);

  let currentFeeStructure = feeStructures.find((fee: any) => {
    const feeClassName = normalize(fee.className ?? fee.class_name ?? fee.name);
    const feeTerm = normalize(fee.term ?? fee.academicTerm ?? fee.term_name);
    const feeClassId = fee.classId ?? fee.class_id;
    const feeTermId = fee.term_id ?? fee.academicTermId;

    const classMatches = (
      (feeClassName && feeClassName === studentClassNorm) ||
      (feeClassId !== undefined && String(feeClassId) === String(studentClass))
    );

    const termMatches = (
      (termId && feeTermId && String(feeTermId) === String(termId)) ||
      (feeTerm && feeTerm === termNorm) ||
      (!feeTerm && !feeTermId) // Global structure
    );

    return classMatches && termMatches;
  });

  // Fallback: try matching by level (fee structure set for the whole level)
  if (!currentFeeStructure) {
    const levelName = extractLevel(studentClass);
    const levelNorm = normalize(levelName);
    currentFeeStructure = feeStructures.find((fee: any) => {
      const feeClassName = normalize(fee.className ?? fee.class_name ?? fee.name);
      const feeTerm = normalize(fee.term ?? fee.academicTerm ?? fee.term_name);
      const feeTermId = fee.term_id ?? fee.academicTermId;

      const termMatches = (
        (termId && feeTermId && String(feeTermId) === String(termId)) ||
        (feeTerm && feeTerm === termNorm) ||
        (!feeTerm && !feeTermId)
      );

      return feeClassName === levelNorm && termMatches;
    });
  }

  const currentTermFee = Number(currentFeeStructure?.amount ?? currentFeeStructure?.amount_due ?? 0) || 0;

  // Get all payments for this student in current term
  const currentTermPayments = payments
    .filter(payment => {
      const pStudentId = String(payment.studentId || payment.student_id);
      const sStudentId = String(studentId);
      if (pStudentId !== sStudentId) return false;

      const pTermId = payment.term_id || payment.termId;
      const pTermName = normalize(payment.term || payment.term_name || payment.termName);

      // Match by ID primarily, then fallback to name
      if (termId && pTermId && String(pTermId) === String(termId)) return true;
      if (termNorm && pTermName === termNorm) return true;

      return false;
    })
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  // Get arrears from parameters
  const arrears = Number(arrearsData ? (arrearsData[studentId] || 0) : 0);

  // Get credit balance from parameters
  const creditBalance = Number(creditData ? (creditData[studentId] || 0) : 0);

  // Calculate total amount due (current term fee + arrears - credit balance)
  const totalAmountDue = Math.max(0, currentTermFee + arrears - creditBalance);

  // Calculate total paid this term
  const totalPaid = Number(currentTermPayments);

  // Calculate final remaining balance
  const remainingBalance = Math.max(0, totalAmountDue - totalPaid);

  return {
    totalFee: currentTermFee,
    arrears: arrears,
    creditBalance: creditBalance,
    totalAmountDue: totalAmountDue,
    totalPaid: totalPaid,
    currentTermFee: currentTermFee,
    remainingBalance: remainingBalance,
    matchedFeeStructure: currentFeeStructure ?? null
  };
};

export const calculateStudentFeeStatus = (
  studentId: string,
  currentTerm: any, // Can be string (name) or object { name, id }
  students: any[],
  feeStructures: any[],
  payments: any[],
  arrearsData?: Record<string, number>,
  creditData?: Record<string, number>
): StudentFeeStatus => {
  const student = students.find(s => String(s.id) === String(studentId));
  if (!student) {
    return { status: 'No Fee Set', balance: 0 };
  }

  const feeCalculation = calculateStudentFees(
    studentId,
    currentTerm,
    student.classAssigned || student.className || '',
    feeStructures,
    payments,
    arrearsData,
    creditData
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

export const processArrearsForTermChange = (
  students: any[],
  payments: any[],
  feeStructures: any[],
  previousTerm: string,
  newTerm: string,
  existingArrears: Record<string, number> = {},
  existingCredit: Record<string, number> = {}
) => {
  const arrearsData: Record<string, number> = {};
  const creditUpdates: Record<string, number> = {};

  students.forEach(student => {
    const calculation = calculateStudentFees(
      student.id,
      previousTerm,
      student.classAssigned,
      feeStructures,
      payments,
      existingArrears,
      existingCredit
    );

    // If student owes money, add to arrears
    if (calculation.totalAmountDue > calculation.totalPaid) {
      arrearsData[student.id] = calculation.totalAmountDue - calculation.totalPaid;
    }

    // If student has overpaid, update credit balance
    if (calculation.totalPaid > calculation.totalAmountDue) {
      const creditBalance = calculation.totalPaid - calculation.totalAmountDue;
      creditUpdates[student.id] = creditBalance;
    }
  });

  return { arrearsData, creditUpdates };
};

// Function to handle class promotion with fee calculations
export const processFeesForClassPromotion = (
  studentId: string,
  oldClass: string,
  newClass: string,
  currentTerm: any, // Can be string (name) or object { name, id }
  feeStructures: any[],
  payments: any[],
  arrearsData: Record<string, number> = {},
  creditData: Record<string, number> = {}
) => {
  // Calculate any outstanding balance in old class
  const oldClassCalculation = calculateStudentFees(
    studentId,
    currentTerm,
    oldClass,
    feeStructures,
    payments,
    arrearsData,
    creditData
  );

  // If there's an outstanding balance, it becomes arrears for the new class
  return oldClassCalculation.remainingBalance;
};

// Function to get receipt header information
export const getReceiptHeader = (savedSettings: any, terms: any[], termOverride?: string) => {
  const schoolSettings = getSchoolSettings(savedSettings);
  const activeTerm = termOverride || getActiveAcademicTerm(terms);
  const activeYear = getActiveAcademicYear(terms);

  return {
    schoolName: schoolSettings.name,
    schoolAddress: schoolSettings.address,
    schoolContact: schoolSettings.contact,
    schoolEmail: schoolSettings.email,
    term: activeTerm,
    year: activeYear,
    generatedDate: new Date().toLocaleDateString(),
    generatedTime: new Date().toLocaleTimeString()
  };
};
