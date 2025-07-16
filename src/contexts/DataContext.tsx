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
  previousSchool: string;
  dateOfAdmission: string;
  notes: string;
}

interface Teacher {
  id: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  staffId: string;
  phoneNumber: string;
  email: string;
  address: string;
  subjectsTaught: string[];
  classAssigned: string;
  employmentDate: string;
  monthlySalary: number;
  employmentStatus: string;
  notes: string;
}

interface Class {
  id: string;
  className: string;
  level: string;
  stream: string;
  assignedTeacher: string;
  maxClassSize: number;
  students: string[];
}

interface FeeStructure {
  id: string;
  className: string;
  term: string;
  amount: number;
  dueDate: string;
  description: string;
}

interface Payment {
  id: string;
  studentId: string;
  amount: number;
  date: string;
  paymentMethod: string;
  term: string;
  notes: string;
}

interface Income {
  id: string;
  source: string;
  amount: number;
  date: string;
  paymentMethod: string;
  receivedBy: string;
  notes: string;
  description?: string;
  category?: string;
}

interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  payeeName: string;
  paymentDate: string;
  paymentMethod: string;
  purpose: string;
  notes: string;
  description?: string;
  vendor?: string;
}

interface DataContextType {
  students: Student[];
  teachers: Teacher[];
  classes: Class[];
  feeStructures: FeeStructure[];
  payments: Payment[];
  income: Income[];
  expenses: Expense[];
  addStudent: (student: Omit<Student, 'id' | 'studentId' | 'admissionNumber'>) => void;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  addTeacher: (teacher: Omit<Teacher, 'id' | 'staffId'>) => void;
  updateTeacher: (id: string, updates: Partial<Teacher>) => void;
  deleteTeacher: (id: string) => void;
  addClass: (classData: Omit<Class, 'id'>) => void;
  updateClass: (id: string, updates: Partial<Class>) => void;
  deleteClass: (id: string) => void;
  addFeeStructure: (fee: Omit<FeeStructure, 'id'>) => void;
  addPayment: (payment: Omit<Payment, 'id'>) => void;
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
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('rosaGardensData');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setStudents(data.students || []);
        setTeachers(data.teachers || []);
        setClasses(data.classes || []);
        setFeeStructures(data.feeStructures || []);
        setPayments(data.payments || []);
        setIncome(data.income || []);
        setExpenses(data.expenses || []);
      } catch (error) {
        console.error('Error loading data:', error);
        initializeSampleData();
      }
    } else {
      initializeSampleData();
    }
  }, []);

  // Save data to localStorage whenever data changes
  useEffect(() => {
    const data = {
      students,
      teachers,
      classes,
      feeStructures,
      payments,
      income,
      expenses
    };
    localStorage.setItem('rosaGardensData', JSON.stringify(data));
  }, [students, teachers, classes, feeStructures, payments, income, expenses]);

  const initializeSampleData = () => {
    // Sample Classes with beautiful flower names
    const sampleClasses: Class[] = [
      {
        id: '1',
        className: 'Lily (Creche)',
        level: 'Creche',
        stream: 'Lily',
        assignedTeacher: '',
        maxClassSize: 15,
        students: []
      },
      {
        id: '2',
        className: 'Daisy (Nursery 1)',
        level: 'Nursery 1',
        stream: 'Daisy',
        assignedTeacher: '',
        maxClassSize: 18,
        students: []
      },
      {
        id: '3',
        className: 'Tulip (Nursery 2)',
        level: 'Nursery 2',
        stream: 'Tulip',
        assignedTeacher: '',
        maxClassSize: 18,
        students: []
      },
      {
        id: '4',
        className: 'Marigold (KG1)',
        level: 'KG1',
        stream: 'Marigold',
        assignedTeacher: '',
        maxClassSize: 20,
        students: []
      },
      {
        id: '5',
        className: 'Rose Reception (KG2)',
        level: 'KG2',
        stream: 'Rose Reception',
        assignedTeacher: '',
        maxClassSize: 20,
        students: []
      },
      {
        id: '6',
        className: 'Alamanda (Class 1)',
        level: 'Class 1',
        stream: 'Alamanda',
        assignedTeacher: '',
        maxClassSize: 25,
        students: []
      },
      {
        id: '7',
        className: 'Buttercup (Class 2)',
        level: 'Class 2',
        stream: 'Buttercup',
        assignedTeacher: '',
        maxClassSize: 25,
        students: []
      },
      {
        id: '8',
        className: 'Crotons (Class 3)',
        level: 'Class 3',
        stream: 'Crotons',
        assignedTeacher: '',
        maxClassSize: 30,
        students: []
      },
      {
        id: '9',
        className: 'Daffodil (Class 4)',
        level: 'Class 4',
        stream: 'Daffodil',
        assignedTeacher: '',
        maxClassSize: 30,
        students: []
      },
      {
        id: '10',
        className: 'Echinacea (Class 5)',
        level: 'Class 5',
        stream: 'Echinacea',
        assignedTeacher: '',
        maxClassSize: 30,
        students: []
      },
      {
        id: '11',
        className: 'Fraxinus (Class 6)',
        level: 'Class 6',
        stream: 'Fraxinus',
        assignedTeacher: '',
        maxClassSize: 30,
        students: []
      },
      {
        id: '12',
        className: 'Gladiolus (JHS 1)',
        level: 'JHS 1',
        stream: 'Gladiolus',
        assignedTeacher: '',
        maxClassSize: 35,
        students: []
      },
      {
        id: '13',
        className: 'Hollyhocks (JHS 2)',
        level: 'JHS 2',
        stream: 'Hollyhocks',
        assignedTeacher: '',
        maxClassSize: 35,
        students: []
      },
      {
        id: '14',
        className: 'Iris (JHS 3)',
        level: 'JHS 3',
        stream: 'Iris',
        assignedTeacher: '',
        maxClassSize: 35,
        students: []
      }
    ];

    // Sample Students
    const sampleStudents: Student[] = [
      {
        id: '1',
        firstName: 'Kofi',
        lastName: 'Asante',
        gender: 'Male',
        dateOfBirth: '2015-03-15',
        nationality: 'Ghanaian',
        studentId: '20240001',
        admissionNumber: 'ADM001',
        classAssigned: 'Daffodil (Class 4)',
        guardianName: 'Mrs. Akosua Asante',
        guardianContact: '+233 24 123 4567',
        homeAddress: 'Accra, Greater Accra Region',
        numberOfSiblings: 1,
        namesOfSiblings: 'Ama Asante',
        previousSchool: 'ABC Primary School',
        dateOfAdmission: '2024-01-15',
        notes: 'Good student, very active in sports'
      },
      {
        id: '2',
        firstName: 'Ama',
        lastName: 'Osei',
        gender: 'Female',
        dateOfBirth: '2018-07-22',
        nationality: 'Ghanaian',
        studentId: '20240002',
        admissionNumber: 'ADM002',
        classAssigned: 'Marigold (KG1)',
        guardianName: 'Mr. Kwame Osei',
        guardianContact: '+233 20 987 6543',
        homeAddress: 'Kumasi, Ashanti Region',
        numberOfSiblings: 0,
        namesOfSiblings: '',
        previousSchool: '',
        dateOfAdmission: '2024-01-10',
        notes: 'Very creative and loves art'
      }
    ];

    // Sample Teachers
    const sampleTeachers: Teacher[] = [
      {
        id: '1',
        fullName: 'Mrs. Akosua Mensah',
        gender: 'Female',
        dateOfBirth: '1985-05-10',
        staffId: 'TCH001',
        phoneNumber: '+233 24 555 0123',
        email: 'akosua.mensah@rosagardens.edu.gh',
        address: 'East Legon, Accra',
        subjectsTaught: ['Mathematics', 'Science'],
        classAssigned: 'Daffodil (Class 4)',
        employmentDate: '2020-01-15',
        monthlySalary: 2500,
        employmentStatus: 'Active',
        notes: 'Excellent teacher with 5 years experience'
      }
    ];

    // Sample Fee Structures
    const sampleFeeStructures: FeeStructure[] = [
      {
        id: '1',
        className: 'Daffodil (Class 4)',
        term: 'Term 1 2024',
        amount: 1200,
        dueDate: '2024-02-15',
        description: 'Tuition fees for Term 1 2024'
      },
      {
        id: '2',
        className: 'Marigold (KG1)',
        term: 'Term 1 2024',
        amount: 800,
        dueDate: '2024-02-15',
        description: 'Tuition fees for Term 1 2024'
      }
    ];

    // Sample Payments
    const samplePayments: Payment[] = [
      {
        id: '1',
        studentId: '1',
        amount: 600,
        date: '2024-01-20',
        paymentMethod: 'Mobile Money',
        term: 'Term 1 2024',
        notes: 'Partial payment - first installment'
      },
      {
        id: '2',
        studentId: '2',
        amount: 800,
        date: '2024-01-18',
        paymentMethod: 'Cash',
        term: 'Term 1 2024',
        notes: 'Full payment for the term'
      }
    ];

    // Sample Income
    const sampleIncome: Income[] = [
      {
        id: '1',
        source: 'Uniform Sales',
        amount: 500,
        date: '2024-01-25',
        paymentMethod: 'Cash',
        receivedBy: 'Admin',
        notes: 'Sale of school uniforms to parents'
      }
    ];

    // Sample Expenses
    const sampleExpenses: Expense[] = [
      {
        id: '1',
        title: 'Office Supplies Purchase',
        category: 'Supplies',
        amount: 350,
        payeeName: 'ABC Stationery Ltd',
        paymentDate: '2024-01-22',
        paymentMethod: 'Cash',
        purpose: 'Monthly office supplies',
        notes: 'Pens, papers, markers for all classes'
      }
    ];

    setClasses(sampleClasses);
    setStudents(sampleStudents);
    setTeachers(sampleTeachers);
    setFeeStructures(sampleFeeStructures);
    setPayments(samplePayments);
    setIncome(sampleIncome);
    setExpenses(sampleExpenses);
  };

  const generateStudentId = () => {
    const year = new Date().getFullYear();
    const existingIds = students.map(s => parseInt(s.studentId)).filter(id => !isNaN(id));
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : year * 10000;
    return (maxId + 1).toString();
  };

  const generateAdmissionNumber = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const existingAdmissions = students
      .map(s => s.admissionNumber)
      .filter(num => num && num.startsWith(`ADM${year}`))
      .map(num => parseInt(num.slice(5)))
      .filter(num => !isNaN(num));
    
    const maxAdmission = existingAdmissions.length > 0 ? Math.max(...existingAdmissions) : 0;
    const nextNumber = (maxAdmission + 1).toString().padStart(3, '0');
    return `ADM${year}${nextNumber}`;
  };

  const generateStaffId = () => {
    const existingStaffIds = teachers
      .map(t => t.staffId)
      .filter(id => id && id.startsWith('TCH'))
      .map(id => parseInt(id.slice(3)))
      .filter(num => !isNaN(num));
    
    const maxStaffId = existingStaffIds.length > 0 ? Math.max(...existingStaffIds) : 0;
    const nextNumber = (maxStaffId + 1).toString().padStart(3, '0');
    return `TCH${nextNumber}`;
  };

  const generateId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  // Student functions
  const addStudent = (studentData: Omit<Student, 'id' | 'studentId' | 'admissionNumber'>) => {
    const newStudent: Student = {
      ...studentData,
      id: generateId(),
      studentId: generateStudentId(),
      admissionNumber: generateAdmissionNumber()
    };
    setStudents(prev => [...prev, newStudent]);
  };

  const updateStudent = (id: string, updates: Partial<Student>) => {
    setStudents(prev => prev.map(student => 
      student.id === id ? { ...student, ...updates } : student
    ));
  };

  const deleteStudent = (id: string) => {
    setStudents(prev => prev.filter(student => student.id !== id));
  };

  // Teacher functions
  const addTeacher = (teacherData: Omit<Teacher, 'id' | 'staffId'>) => {
    const newTeacher: Teacher = {
      ...teacherData,
      id: generateId(),
      staffId: generateStaffId()
    };
    setTeachers(prev => [...prev, newTeacher]);
  };

  const updateTeacher = (id: string, updates: Partial<Teacher>) => {
    setTeachers(prev => prev.map(teacher => 
      teacher.id === id ? { ...teacher, ...updates } : teacher
    ));
  };

  const deleteTeacher = (id: string) => {
    setTeachers(prev => prev.filter(teacher => teacher.id !== id));
  };

  // Class functions
  const addClass = (classData: Omit<Class, 'id'>) => {
    const newClass: Class = {
      ...classData,
      id: generateId()
    };
    setClasses(prev => [...prev, newClass]);
  };

  const updateClass = (id: string, updates: Partial<Class>) => {
    setClasses(prev => prev.map(cls => 
      cls.id === id ? { ...cls, ...updates } : cls
    ));
  };

  const deleteClass = (id: string) => {
    setClasses(prev => prev.filter(cls => cls.id !== id));
  };

  // Fee and Payment functions
  const addFeeStructure = (feeData: Omit<FeeStructure, 'id'>) => {
    const newFee: FeeStructure = {
      ...feeData,
      id: generateId()
    };
    setFeeStructures(prev => [...prev, newFee]);
  };

  const addPayment = (paymentData: Omit<Payment, 'id'>) => {
    const newPayment: Payment = {
      ...paymentData,
      id: generateId()
    };
    setPayments(prev => [...prev, newPayment]);
  };

  // Income and Expense functions
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

  // Promotion functions
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
      feeStructures,
      payments,
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
      addFeeStructure,
      addPayment,
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
