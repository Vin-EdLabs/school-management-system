
import React, { createContext, useContext, useState, useEffect } from 'react';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  studentId: string;
  admissionNumber: string;
  classAssigned: string;
  guardianName: string;
  guardianContact: string;
  homeAddress: string;
  numberOfSiblings: number;
  namesOfSiblings: string;
  previousSchool?: string;
  dateOfAdmission: string;
  passportPhoto?: string;
  notes?: string;
}

interface Teacher {
  id: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  nationalId: string;
  phoneNumber: string;
  email: string;
  address: string;
  subjectsTaught: string[];
  classAssigned?: string;
  employmentDate: string;
  monthlySalary?: number;
  photo?: string;
  cvDocument?: string;
  employmentStatus: 'Active' | 'Left' | 'Suspended';
  notes?: string;
}

interface Class {
  id: string;
  className: string;
  level: string;
  stream?: string;
  assignedTeacher?: string;
  maxClassSize?: number;
  students: string[];
}

interface Payment {
  id: string;
  studentId: string;
  amount: number;
  date: string;
  method: 'Cash' | 'MoMo' | 'Bank';
  term: string;
  notes?: string;
  receiptNumber: string;
}

interface FeeStructure {
  id: string;
  className: string;
  term: string;
  amount: number;
  dueDate: string;
  breakdown?: string;
}

interface Income {
  id: string;
  source: string;
  amount: number;
  date: string;
  method: string;
  receivedBy: string;
  notes?: string;
}

interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  payeeName: string;
  paymentDate: string;
  method: string;
  purpose: string;
  receipt?: string;
}

interface DataContextType {
  students: Student[];
  teachers: Teacher[];
  classes: Class[];
  payments: Payment[];
  feeStructures: FeeStructure[];
  income: Income[];
  expenses: Expense[];
  addStudent: (student: Omit<Student, 'id' | 'studentId'>) => void;
  updateStudent: (id: string, student: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  addTeacher: (teacher: Omit<Teacher, 'id'>) => void;
  updateTeacher: (id: string, teacher: Partial<Teacher>) => void;
  deleteTeacher: (id: string) => void;
  addClass: (classData: Omit<Class, 'id'>) => void;
  updateClass: (id: string, classData: Partial<Class>) => void;
  deleteClass: (id: string) => void;
  addPayment: (payment: Omit<Payment, 'id' | 'receiptNumber'>) => void;
  addFeeStructure: (fee: Omit<FeeStructure, 'id'>) => void;
  addIncome: (income: Omit<Income, 'id'>) => void;
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  promoteStudent: (studentId: string, newClass: string) => void;
  promoteClass: (currentClass: string, newClass: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Generate unique IDs
  const generateId = () => Math.random().toString(36).substr(2, 9);
  const generateStudentId = () => Math.floor(10000000 + Math.random() * 90000000).toString();
  const generateReceiptNumber = () => `RG${Date.now()}`;

  // Load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('rosaGardensData');
    if (savedData) {
      const data = JSON.parse(savedData);
      setStudents(data.students || []);
      setTeachers(data.teachers || []);
      setClasses(data.classes || []);
      setPayments(data.payments || []);
      setFeeStructures(data.feeStructures || []);
      setIncome(data.income || []);
      setExpenses(data.expenses || []);
    } else {
      // Initialize with sample data
      initializeSampleData();
    }
  }, []);

  // Save data to localStorage whenever state changes
  useEffect(() => {
    const data = {
      students,
      teachers,
      classes,
      payments,
      feeStructures,
      income,
      expenses
    };
    localStorage.setItem('rosaGardensData', JSON.stringify(data));
  }, [students, teachers, classes, payments, feeStructures, income, expenses]);

  const initializeSampleData = () => {
    // Sample classes
    const sampleClasses: Class[] = [
      {
        id: generateId(),
        className: 'Primary 1 Red',
        level: 'Primary 1',
        stream: 'Red',
        assignedTeacher: '',
        maxClassSize: 25,
        students: []
      },
      {
        id: generateId(),
        className: 'Primary 2 Blue',
        level: 'Primary 2',
        stream: 'Blue',
        assignedTeacher: '',
        maxClassSize: 25,
        students: []
      },
      {
        id: generateId(),
        className: 'Primary 3 Green',
        level: 'Primary 3',
        stream: 'Green',
        assignedTeacher: '',
        maxClassSize: 30,
        students: []
      }
    ];

    // Sample students
    const sampleStudents: Student[] = [
      {
        id: generateId(),
        firstName: 'Kofi',
        lastName: 'Asante',
        gender: 'Male',
        dateOfBirth: '2015-03-15',
        nationality: 'Ghanaian',
        studentId: generateStudentId(),
        admissionNumber: 'RG001',
        classAssigned: 'Primary 1 Red',
        guardianName: 'Mr. Kwame Asante',
        guardianContact: '0244123456',
        homeAddress: 'Accra, Ghana',
        numberOfSiblings: 1,
        namesOfSiblings: 'Ama Asante',
        dateOfAdmission: '2023-09-01',
        notes: 'Active learner'
      },
      {
        id: generateId(),
        firstName: 'Ama',
        lastName: 'Osei',
        gender: 'Female',
        dateOfBirth: '2014-07-22',
        nationality: 'Ghanaian',
        studentId: generateStudentId(),
        admissionNumber: 'RG002',
        classAssigned: 'Primary 2 Blue',
        guardianName: 'Mrs. Grace Osei',
        guardianContact: '0244987654',
        homeAddress: 'Kumasi, Ghana',
        numberOfSiblings: 0,
        namesOfSiblings: '',
        dateOfAdmission: '2023-09-01',
        notes: 'Excellent in mathematics'
      }
    ];

    // Sample teachers
    const sampleTeachers: Teacher[] = [
      {
        id: generateId(),
        fullName: 'Mrs. Elizabeth Mensah',
        gender: 'Female',
        dateOfBirth: '1985-05-10',
        nationalId: 'GHA-123456789-0',
        phoneNumber: '0244555666',
        email: 'elizabeth.mensah@rosagarden.edu.gh',
        address: 'East Legon, Accra',
        subjectsTaught: ['Mathematics', 'English'],
        classAssigned: 'Primary 1 Red',
        employmentDate: '2020-08-15',
        monthlySalary: 3000,
        employmentStatus: 'Active',
        notes: 'Head of Primary Department'
      }
    ];

    // Sample fee structures
    const sampleFees: FeeStructure[] = [
      {
        id: generateId(),
        className: 'Primary 1 Red',
        term: 'Term 1 2024',
        amount: 800,
        dueDate: '2024-01-15',
        breakdown: 'Tuition: 600, Books: 100, Activities: 100'
      },
      {
        id: generateId(),
        className: 'Primary 2 Blue',
        term: 'Term 1 2024',
        amount: 850,
        dueDate: '2024-01-15',
        breakdown: 'Tuition: 650, Books: 100, Activities: 100'
      }
    ];

    // Sample payments
    const samplePayments: Payment[] = [
      {
        id: generateId(),
        studentId: sampleStudents[0].id,
        amount: 400,
        date: '2024-01-10',
        method: 'MoMo',
        term: 'Term 1 2024',
        receiptNumber: generateReceiptNumber(),
        notes: 'Partial payment'
      }
    ];

    // Sample income
    const sampleIncome: Income[] = [
      {
        id: generateId(),
        source: 'Registration Fees',
        amount: 2000,
        date: '2024-01-05',
        method: 'Bank Transfer',
        receivedBy: 'Admin',
        notes: 'New student registrations'
      }
    ];

    // Sample expenses
    const sampleExpenses: Expense[] = [
      {
        id: generateId(),
        title: 'Office Supplies',
        category: 'Supplies',
        amount: 500,
        payeeName: 'StationeryPlus Ltd',
        paymentDate: '2024-01-08',
        method: 'Cash',
        purpose: 'Monthly office supplies'
      }
    ];

    setClasses(sampleClasses);
    setStudents(sampleStudents);
    setTeachers(sampleTeachers);
    setFeeStructures(sampleFees);
    setPayments(samplePayments);
    setIncome(sampleIncome);
    setExpenses(sampleExpenses);
  };

  const addStudent = (studentData: Omit<Student, 'id' | 'studentId'>) => {
    const newStudent: Student = {
      ...studentData,
      id: generateId(),
      studentId: generateStudentId()
    };
    setStudents(prev => [...prev, newStudent]);
  };

  const updateStudent = (id: string, studentData: Partial<Student>) => {
    setStudents(prev => prev.map(student => 
      student.id === id ? { ...student, ...studentData } : student
    ));
  };

  const deleteStudent = (id: string) => {
    setStudents(prev => prev.filter(student => student.id !== id));
  };

  const addTeacher = (teacherData: Omit<Teacher, 'id'>) => {
    const newTeacher: Teacher = {
      ...teacherData,
      id: generateId()
    };
    setTeachers(prev => [...prev, newTeacher]);
  };

  const updateTeacher = (id: string, teacherData: Partial<Teacher>) => {
    setTeachers(prev => prev.map(teacher => 
      teacher.id === id ? { ...teacher, ...teacherData } : teacher
    ));
  };

  const deleteTeacher = (id: string) => {
    setTeachers(prev => prev.filter(teacher => teacher.id !== id));
  };

  const addClass = (classData: Omit<Class, 'id'>) => {
    const newClass: Class = {
      ...classData,
      id: generateId()
    };
    setClasses(prev => [...prev, newClass]);
  };

  const updateClass = (id: string, classData: Partial<Class>) => {
    setClasses(prev => prev.map(cls => 
      cls.id === id ? { ...cls, ...classData } : cls
    ));
  };

  const deleteClass = (id: string) => {
    setClasses(prev => prev.filter(cls => cls.id !== id));
  };

  const addPayment = (paymentData: Omit<Payment, 'id' | 'receiptNumber'>) => {
    const newPayment: Payment = {
      ...paymentData,
      id: generateId(),
      receiptNumber: generateReceiptNumber()
    };
    setPayments(prev => [...prev, newPayment]);
  };

  const addFeeStructure = (feeData: Omit<FeeStructure, 'id'>) => {
    const newFee: FeeStructure = {
      ...feeData,
      id: generateId()
    };
    setFeeStructures(prev => [...prev, newFee]);
  };

  const addIncome = (incomeData: Omit<Income, 'id'>) => {
    const newIncome: Income = {
      ...incomeData,
      id: generateId()
    };
    setIncome(prev => [...prev, newIncome]);
  };

  const addExpense = (expenseData: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expenseData,
      id: generateId()
    };
    setExpenses(prev => [...prev, newExpense]);
  };

  const promoteStudent = (studentId: string, newClass: string) => {
    updateStudent(studentId, { classAssigned: newClass });
  };

  const promoteClass = (currentClass: string, newClass: string) => {
    const studentsToPromote = students.filter(student => student.classAssigned === currentClass);
    studentsToPromote.forEach(student => {
      updateStudent(student.id, { classAssigned: newClass });
    });
  };

  return (
    <DataContext.Provider value={{
      students,
      teachers,
      classes,
      payments,
      feeStructures,
      income,
      expenses,
      addStudent,
      updateStudent,
      deleteStudent,
      addTeacher,
      updateTeacher,
      deleteTeacher,
      addClass,
      updateClass,
      deleteClass,
      addPayment,
      addFeeStructure,
      addIncome,
      addExpense,
      promoteStudent,
      promoteClass
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
