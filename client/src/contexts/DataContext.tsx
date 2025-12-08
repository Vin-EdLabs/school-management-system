
import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiService } from '../services/api';
import ENDPOINTS from '../services/endpoints';

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
    let mounted = true;
    // Try to load from backend API first
    (async () => {
      try {
        const [studentsRes, teachersRes, classesRes, feesRes, paymentsRes, incomeRes, expensesRes] = await Promise.all([
          apiService.get(ENDPOINTS.students).catch(() => ({ data: [] })),
          apiService.get('/teachers').catch(() => ({ data: [] })),
          apiService.get(ENDPOINTS.classes).catch(() => ({ data: [] })),
          apiService.get(ENDPOINTS.feeStructures).catch(() => ({ data: [] })),
          apiService.get(ENDPOINTS.payments).catch(() => ({ data: [] })),
          apiService.get(ENDPOINTS.income).catch(() => ({ data: [] })),
          apiService.get(ENDPOINTS.expenses).catch(() => ({ data: [] })),
        ]);

        if (!mounted) return;

        const apiAvailable = Array.isArray(studentsRes?.data) || Array.isArray(classesRes?.data);
        if (apiAvailable) {
          setStudents(studentsRes.data || []);
          setTeachers(teachersRes.data || []);
          setClasses(classesRes.data || initializeDefaultClasses());
          setFeeStructures(feesRes.data || []);
          setPayments(paymentsRes.data || []);
          setIncome(incomeRes.data || []);
          setExpenses(expensesRes.data || []);
          // persist a copy locally
          const data = { students: studentsRes.data || [], teachers: teachersRes.data || [], classes: classesRes.data || [], feeStructures: feesRes.data || [], payments: paymentsRes.data || [], income: incomeRes.data || [], expenses: expensesRes.data || [] };
          localStorage.setItem('rosaGardensData', JSON.stringify(data));
          return;
        }
      } catch (error) {
        // ignore and fall back to localStorage
      }

      const savedData = localStorage.getItem('rosaGardensData');
      if (savedData) {
        try {
          const data = JSON.parse(savedData);
          setStudents(data.students || []);
          setTeachers(data.teachers || []);
          setClasses(data.classes || initializeDefaultClasses());
          setFeeStructures(data.feeStructures || []);
          setPayments(data.payments || []);
          setIncome(data.income || []);
          setExpenses(data.expenses || []);
        } catch (error) {
          console.error('Error loading data:', error);
          setClasses(initializeDefaultClasses());
        }
      } else {
        setClasses(initializeDefaultClasses());
      }
    })();
    return () => { mounted = false; };
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

  const initializeDefaultClasses = (): Class[] => {
    return [
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
  };

  const generateId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
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

  // Student functions
  const addStudent = (studentData: Omit<Student, 'id' | 'studentId' | 'admissionNumber'>) => {
    (async () => {
      try {
        // try backend
        const res: any = await apiService.post(ENDPOINTS.students, studentData);
        const created = res?.data ?? res;
        setStudents(prev => [...prev, created]);
        return;
      } catch (e) {
        // fallback to local
        const newStudent: Student = {
          ...studentData,
          id: generateId(),
          studentId: generateStudentId(),
          admissionNumber: generateAdmissionNumber()
        };
        setStudents(prev => [...prev, newStudent]);
      }
    })();
  };

  const updateStudent = (id: string, updates: Partial<Student>) => {
    (async () => {
      try {
        await apiService.put(`${ENDPOINTS.students}/${id}`, updates);
        setStudents(prev => prev.map(student => student.id === id ? { ...student, ...updates } : student));
      } catch (e) {
        // local fallback
        setStudents(prev => prev.map(student => student.id === id ? { ...student, ...updates } : student));
      }
    })();
  };

  const deleteStudent = (id: string) => {
    (async () => {
      try {
        await apiService.delete(`${ENDPOINTS.students}/${id}`);
        setStudents(prev => prev.filter(student => student.id !== id));
      } catch (e) {
        // fallback
        setStudents(prev => prev.filter(student => student.id !== id));
      }
    })();
  };

  // Teacher functions
  const addTeacher = (teacherData: Omit<Teacher, 'id' | 'staffId'>) => {
    (async () => {
      try {
        const res: any = await apiService.post('/teachers', teacherData);
        const created = res?.data ?? res;
        setTeachers(prev => [...prev, created]);
        return;
      } catch (e) {
        const newTeacher: Teacher = {
          ...teacherData,
          id: generateId(),
          staffId: generateStaffId()
        };
        setTeachers(prev => [...prev, newTeacher]);
      }
    })();
  };

  const updateTeacher = (id: string, updates: Partial<Teacher>) => {
    (async () => {
      try {
        await apiService.put(`/teachers/${id}`, updates);
        setTeachers(prev => prev.map(teacher => teacher.id === id ? { ...teacher, ...updates } : teacher));
      } catch (e) {
        setTeachers(prev => prev.map(teacher => teacher.id === id ? { ...teacher, ...updates } : teacher));
      }
    })();
  };

  const deleteTeacher = (id: string) => {
    (async () => {
      try {
        await apiService.delete(`/teachers/${id}`);
        setTeachers(prev => prev.filter(teacher => teacher.id !== id));
      } catch (e) {
        setTeachers(prev => prev.filter(teacher => teacher.id !== id));
      }
    })();
  };

  // Class functions
  const addClass = (classData: Omit<Class, 'id'>) => {
    (async () => {
      try {
        const res: any = await apiService.post(ENDPOINTS.classes, classData);
        const created = res?.data ?? res;
        setClasses(prev => [...prev, created]);
        return;
      } catch (e) {
        const newClass: Class = { ...classData, id: generateId() };
        setClasses(prev => [...prev, newClass]);
      }
    })();
  };

  const updateClass = (id: string, updates: Partial<Class>) => {
    (async () => {
      try {
        await apiService.put(`${ENDPOINTS.classes}/${id}`, updates);
        setClasses(prev => prev.map(cls => cls.id === id ? { ...cls, ...updates } : cls));
      } catch (e) {
        setClasses(prev => prev.map(cls => cls.id === id ? { ...cls, ...updates } : cls));
      }
    })();
  };

  const deleteClass = (id: string) => {
    (async () => {
      try {
        await apiService.delete(`${ENDPOINTS.classes}/${id}`);
        setClasses(prev => prev.filter(cls => cls.id !== id));
      } catch (e) {
        setClasses(prev => prev.filter(cls => cls.id !== id));
      }
    })();
  };

  // Fee and Payment functions
  const addFeeStructure = (feeData: Omit<FeeStructure, 'id'>) => {
    (async () => {
      try {
        const res: any = await apiService.post(ENDPOINTS.feeStructures, feeData);
        const created = res?.data ?? res;
        setFeeStructures(prev => [...prev, created]);
      } catch (e) {
        const newFee: FeeStructure = { ...feeData, id: generateId() };
        setFeeStructures(prev => [...prev, newFee]);
      }
    })();
  };

  const addPayment = (paymentData: Omit<Payment, 'id'>) => {
    (async () => {
      try {
        const res: any = await apiService.post(ENDPOINTS.payments, paymentData);
        const created = res?.data ?? res;
        setPayments(prev => [...prev, created]);
      } catch (e) {
        const newPayment: Payment = { ...paymentData, id: generateId() };
        setPayments(prev => [...prev, newPayment]);
      }
    })();
  };

  // Income and Expense functions
  const addIncome = (incomeData: Omit<Income, 'id'>) => {
    (async () => {
      try {
        const res: any = await apiService.post(ENDPOINTS.income, incomeData);
        const created = res?.data ?? res;
        setIncome(prev => [...prev, created]);
      } catch (e) {
        const newIncome: Income = { ...incomeData, id: generateId() };
        setIncome(prev => [...prev, newIncome]);
      }
    })();
  };

  const addExpense = (expenseData: Omit<Expense, 'id'>) => {
    (async () => {
      try {
        const res: any = await apiService.post(ENDPOINTS.expenses, expenseData);
        const created = res?.data ?? res;
        setExpenses(prev => [...prev, created]);
      } catch (e) {
        const newExpense: Expense = { ...expenseData, id: generateId() };
        setExpenses(prev => [...prev, newExpense]);
      }
    })();
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
