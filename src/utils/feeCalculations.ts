export interface FeeCalculation {
  totalFee: number;
  arrears: number;
  creditBalance: number;
  totalAmountDue: number;
  totalPaid: number;
  currentTermFee: number;
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

export const calculateStudentFees = (
  studentId: string,
  currentTerm: string,
  studentClass: string,
  feeStructures: any[],
  payments: any[]
): FeeCalculation => {
  // Get current term fee structure
  const currentFeeStructure = feeStructures.find(fee => 
    fee.className === studentClass && fee.term === currentTerm
  );
  const currentTermFee = currentFeeStructure?.amount || 0;

  // Get all payments for this student in current term
  const currentTermPayments = payments
    .filter(payment => payment.studentId === studentId && payment.term === currentTerm)
    .reduce((sum, payment) => sum + payment.amount, 0);

  // Get arrears from previous terms
  const termParts = currentTerm.split(' ');
  const currentYear = termParts[termParts.length - 1];
  const arrearsKey = `arrears-${currentTerm.toLowerCase().replace(/\s+/g, '-')}`;
  const arrearsData = localStorage.getItem(arrearsKey);
  const arrears = arrearsData ? (JSON.parse(arrearsData)[studentId] || 0) : 0;

  // Get credit balance from previous terms
  const creditKey = `credit-${studentId}`;
  const creditData = localStorage.getItem(creditKey);
  const creditBalance = creditData ? parseFloat(creditData) : 0;

  // Calculate total amount due
  const totalAmountDue = currentTermFee + arrears - creditBalance;
  
  // Calculate if student has overpaid
  const totalPaid = currentTermPayments;
  const newCreditBalance = Math.max(0, totalPaid - totalAmountDue);
  
  // Update credit balance if there's an overpayment
  if (newCreditBalance > 0) {
    localStorage.setItem(creditKey, newCreditBalance.toString());
  }

  return {
    totalFee: currentTermFee,
    arrears: arrears,
    creditBalance: creditBalance,
    totalAmountDue: Math.max(0, totalAmountDue),
    totalPaid: totalPaid,
    currentTermFee: currentTermFee
  };
};

export const calculateStudentFeeStatus = (
  studentId: string,
  currentTerm: string,
  students: any[],
  feeStructures: any[],
  payments: any[]
): StudentFeeStatus => {
  const student = students.find(s => s.id === studentId);
  if (!student) {
    return { status: 'No Fee Set', balance: 0 };
  }

  const feeCalculation = calculateStudentFees(
    studentId,
    currentTerm,
    student.classAssigned,
    feeStructures,
    payments
  );

  // If no fee structure is set for this class/term
  if (feeCalculation.currentTermFee === 0) {
    return { status: 'No Fee Set', balance: 0 };
  }

  const balance = feeCalculation.totalAmountDue - feeCalculation.totalPaid;

  if (balance === 0) {
    return { status: 'Fully Paid', balance: 0 };
  } else if (balance > 0) {
    return { status: 'Amount Owing', balance: balance };
  } else {
    return { status: 'Credit Balance', balance: balance };
  }
};

export const getActiveAcademicTerm = () => {
  const savedTerms = localStorage.getItem('academicTerms');
  if (savedTerms) {
    try {
      const terms = JSON.parse(savedTerms);
      const activeTerm = terms.find((term: any) => term.isActive);
      return activeTerm ? `${activeTerm.name} ${activeTerm.year}` : 'Term 1 2024';
    } catch (error) {
      console.error('Error loading academic terms:', error);
    }
  }
  return 'Term 1 2024';
};

export const getActiveAcademicYear = () => {
  const savedTerms = localStorage.getItem('academicTerms');
  if (savedTerms) {
    try {
      const terms = JSON.parse(savedTerms);
      const activeTerm = terms.find((term: any) => term.isActive);
      return activeTerm ? activeTerm.year : '2024';
    } catch (error) {
      console.error('Error loading academic terms:', error);
    }
  }
  return '2024';
};

export const processArrearsForTermChange = (
  students: any[],
  payments: any[],
  feeStructures: any[],
  previousTerm: string,
  newTerm: string
) => {
  const arrearsData: Record<string, number> = {};
  
  students.forEach(student => {
    const calculation = calculateStudentFees(
      student.id,
      previousTerm,
      student.classAssigned,
      feeStructures,
      payments
    );
    
    if (calculation.totalAmountDue > calculation.totalPaid) {
      arrearsData[student.id] = calculation.totalAmountDue - calculation.totalPaid;
    }
  });

  // Store arrears for the new term
  const arrearsKey = `arrears-${newTerm.toLowerCase().replace(/\s+/g, '-')}`;
  localStorage.setItem(arrearsKey, JSON.stringify(arrearsData));
  
  return arrearsData;
};
