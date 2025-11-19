
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

export const getSchoolSettings = () => {
  const defaultSettings = {
    name: 'Rosa Gardens School',
    address: 'Accra, Ghana',
    contact: '+233 XX XXX XXXX',
    email: 'info@rosagardens.edu.gh'
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

export const getActiveAcademicTerm = () => {
  const savedTerms = localStorage.getItem('academicTerms');
  if (savedTerms) {
    try {
      const terms = JSON.parse(savedTerms);
      const activeTerm = terms.find((term: any) => term.isActive);
      return activeTerm ? `${activeTerm.name}` : 'Term 1';
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
  const arrearsKey = `arrears-${currentTerm.toLowerCase().replace(/\s+/g, '-')}`;
  const arrearsData = localStorage.getItem(arrearsKey);
  const arrears = arrearsData ? (JSON.parse(arrearsData)[studentId] || 0) : 0;

  // Get credit balance from previous terms
  const creditKey = `credit-${studentId}`;
  const creditData = localStorage.getItem(creditKey);
  const creditBalance = creditData ? parseFloat(creditData) : 0;

  // Calculate total amount due (current term fee + arrears - credit balance)
  const totalAmountDue = Math.max(0, currentTermFee + arrears - creditBalance);
  
  // Calculate if student has overpaid
  const totalPaid = currentTermPayments;
  const newCreditBalance = Math.max(0, totalPaid - totalAmountDue);
  
  // Update credit balance if there's an overpayment
  if (newCreditBalance > 0 && newCreditBalance !== creditBalance) {
    localStorage.setItem(creditKey, newCreditBalance.toString());
  }

  return {
    totalFee: currentTermFee,
    arrears: arrears,
    creditBalance: creditBalance,
    totalAmountDue: totalAmountDue,
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
  newTerm: string
) => {
  const arrearsData: Record<string, number> = {};
  const creditUpdates: Record<string, number> = {};
  
  students.forEach(student => {
    const calculation = calculateStudentFees(
      student.id,
      previousTerm,
      student.classAssigned,
      feeStructures,
      payments
    );
    
    // If student owes money, add to arrears
    if (calculation.totalAmountDue > calculation.totalPaid) {
      arrearsData[student.id] = calculation.totalAmountDue - calculation.totalPaid;
    }
    
    // If student has overpaid, update credit balance
    if (calculation.totalPaid > calculation.totalAmountDue) {
      const creditBalance = calculation.totalPaid - calculation.totalAmountDue;
      creditUpdates[student.id] = creditBalance;
      localStorage.setItem(`credit-${student.id}`, creditBalance.toString());
    }
  });

  // Store arrears for the new term
  const arrearsKey = `arrears-${newTerm.toLowerCase().replace(/\s+/g, '-')}`;
  localStorage.setItem(arrearsKey, JSON.stringify(arrearsData));
  
  console.log(`Processed arrears for term change from ${previousTerm} to ${newTerm}:`, {
    studentsWithArrears: Object.keys(arrearsData).length,
    totalArrears: Object.values(arrearsData).reduce((sum, amount) => sum + amount, 0),
    studentsWithCredit: Object.keys(creditUpdates).length,
    totalCredit: Object.values(creditUpdates).reduce((sum, amount) => sum + amount, 0)
  });
  
  return { arrearsData, creditUpdates };
};

// Function to handle class promotion with fee calculations
export const processFeesForClassPromotion = (
  studentId: string,
  oldClass: string,
  newClass: string,
  currentTerm: string,
  feeStructures: any[],
  payments: any[]
) => {
  // Calculate any outstanding balance in old class
  const oldClassCalculation = calculateStudentFees(
    studentId,
    currentTerm,
    oldClass,
    feeStructures,
    payments
  );
  
  // If there's an outstanding balance, it becomes arrears for the new class
  const outstandingBalance = Math.max(0, oldClassCalculation.totalAmountDue - oldClassCalculation.totalPaid);
  
  if (outstandingBalance > 0) {
    // Add to arrears for current term
    const arrearsKey = `arrears-${currentTerm.toLowerCase().replace(/\s+/g, '-')}`;
    const existingArrears = localStorage.getItem(arrearsKey);
    const arrearsData = existingArrears ? JSON.parse(existingArrears) : {};
    
    arrearsData[studentId] = (arrearsData[studentId] || 0) + outstandingBalance;
    localStorage.setItem(arrearsKey, JSON.stringify(arrearsData));
    
    console.log(`Added arrears for student ${studentId} promotion from ${oldClass} to ${newClass}: GHS ${outstandingBalance}`);
  }
  
  return outstandingBalance;
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
    generatedDate: new Date().toLocaleDateString(),
    generatedTime: new Date().toLocaleTimeString()
  };
};
