
<<<<<<< HEAD:src/contexts/DataContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import { useSchool } from './SchoolContext';
=======
import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiService } from '../services/api';
import ENDPOINTS from '../services/endpoints';
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/contexts/DataContext.tsx

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
  classAssignedId?: number;
  guardianName: string;
  guardianContact: string;
  homeAddress: string;
  previousSchool: string;
  dateOfAdmission: string;
  notes: string;
  passportPhotoUrl?: string;
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
  classAssignedId?: number;
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
  assignedTeacherId?: number;
  maxClassSize: number;
  students: string[];
  studentCount?: number;
}

interface FeeStructure {
  id: string;
  className: string;
  classId?: number;
  term: string;
  amount: number;
  dueDate: string;
  description: string;
}

interface Payment {
  id: string;
  studentId: string;
  studentIdNum?: number;
  amount: number;
  date: string;
  paymentMethod: string;
  term: string;
  notes: string;
  receiptNumber?: string;
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

interface Subject {
  id: string;
  name: string;
  code?: string;
  level?: string;
}

interface DataContextType {
  students: Student[];
  teachers: Teacher[];
  classes: Class[];
  feeStructures: FeeStructure[];
  payments: Payment[];
  income: Income[];
  expenses: Expense[];
  subjects: Subject[];
  arrearsBalances: Record<string, number>;
  loading: boolean;
  refresh: () => Promise<void>;
  addStudent: (student: Omit<Student, 'id' | 'studentId' | 'admissionNumber'>) => Promise<{ id: string } | void>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  addTeacher: (teacher: Omit<Teacher, 'id' | 'staffId'>) => Promise<{ loginStaffId?: string; loginPin?: string; loginMessage?: string } | void>;
  updateTeacher: (id: string, updates: Partial<Teacher>) => Promise<void>;
  deleteTeacher: (id: string) => Promise<void>;
  addClass: (classData: Omit<Class, 'id'>) => Promise<void>;
  updateClass: (id: string, updates: Partial<Class>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  addFeeStructure: (fee: Omit<FeeStructure, 'id'>) => Promise<void>;
  updateFeeStructure: (id: string, fee: Partial<FeeStructure>) => Promise<void>;
  deleteFeeStructure: (id: string) => Promise<void>;
  addPayment: (payment: Omit<Payment, 'id'> & { academicYear?: string }) => Promise<Payment>;
  addIncome: (income: Omit<Income, 'id'>) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  addSubject: (subject: Omit<Subject, 'id'>) => Promise<void>;
  updateSubject: (id: string, subject: Partial<Subject>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  promoteStudent: (studentId: string, newClass: string, currentTerm?: string, academicYear?: string) => Promise<void>;
  promoteClass: (currentClass: string, newClass: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Helper function to map backend student to frontend format
const mapStudent = (backendStudent: any): Student => ({
  id: backendStudent.id.toString(),
  firstName: backendStudent.first_name,
  lastName: backendStudent.last_name,
  gender: backendStudent.gender || '',
  dateOfBirth: backendStudent.date_of_birth || '',
  nationality: backendStudent.nationality || '',
  studentId: backendStudent.student_id,
  admissionNumber: backendStudent.admission_number,
  classAssigned: backendStudent.class_name || '',
  classAssignedId: backendStudent.class_assigned_id,
  guardianName: backendStudent.guardian_name || '',
  guardianContact: backendStudent.guardian_contact || '',
  homeAddress: backendStudent.home_address || '',
  numberOfSiblings: backendStudent.number_of_siblings || 0,
  namesOfSiblings: backendStudent.names_of_siblings || '',
  previousSchool: backendStudent.previous_school || '',
  dateOfAdmission: backendStudent.date_of_admission || '',
  notes: backendStudent.notes || '',
  passportPhotoUrl: backendStudent.passport_photo_url || undefined,
});

// Helper function to map frontend student to backend format
const mapStudentToBackend = (student: Partial<Student>): any => ({
  first_name: student.firstName,
  last_name: student.lastName,
  gender: student.gender,
  date_of_birth: student.dateOfBirth,
  nationality: student.nationality,
  class_assigned_id: student.classAssignedId,
  guardian_name: student.guardianName,
  guardian_contact: student.guardianContact,
  home_address: student.homeAddress,
  number_of_siblings: student.numberOfSiblings,
  names_of_siblings: student.namesOfSiblings,
  previous_school: student.previousSchool,
  date_of_admission: student.dateOfAdmission,
  notes: student.notes,
  passport_photo_url: student.passportPhotoUrl,
});

// Helper function to map backend teacher to frontend format
const mapTeacher = (backendTeacher: any): Teacher => ({
  id: backendTeacher.id.toString(),
  fullName: backendTeacher.full_name,
  gender: backendTeacher.gender || '',
  dateOfBirth: backendTeacher.date_of_birth || '',
  staffId: backendTeacher.staff_id,
  phoneNumber: backendTeacher.phone_number || '',
  email: backendTeacher.email || '',
  address: backendTeacher.address || '',
  subjectsTaught: backendTeacher.subjects_taught || [],
  classAssigned: backendTeacher.class_name || '',
  classAssignedId: backendTeacher.class_assigned_id,
  employmentDate: backendTeacher.employment_date || '',
  monthlySalary: backendTeacher.monthly_salary || 0,
  employmentStatus: backendTeacher.employment_status || '',
  notes: backendTeacher.notes || '',
});

// Helper function to map frontend teacher to backend format (only defined fields for partial updates)
const mapTeacherToBackend = (teacher: Partial<Teacher>): any => {
  const out: Record<string, unknown> = {};
  if (teacher.fullName !== undefined) out.full_name = teacher.fullName;
  if (teacher.gender !== undefined) out.gender = teacher.gender;
  if (teacher.dateOfBirth !== undefined) out.date_of_birth = teacher.dateOfBirth;
  if (teacher.phoneNumber !== undefined) out.phone_number = teacher.phoneNumber;
  if (teacher.email !== undefined) out.email = teacher.email;
  if (teacher.address !== undefined) out.address = teacher.address;
  if (teacher.subjectsTaught !== undefined) out.subjects_taught = teacher.subjectsTaught;
  if (teacher.classAssignedId !== undefined) out.class_assigned_id = teacher.classAssignedId;
  if (teacher.employmentDate !== undefined) out.employment_date = teacher.employmentDate;
  if (teacher.monthlySalary !== undefined) out.monthly_salary = teacher.monthlySalary;
  if (teacher.employmentStatus !== undefined) out.employment_status = teacher.employmentStatus;
  if (teacher.notes !== undefined) out.notes = teacher.notes;
  return out;
};

// Helper function to map backend class to frontend format
const mapClass = (backendClass: any): Class => ({
  id: backendClass.id.toString(),
  className: backendClass.class_name,
  level: backendClass.level || '',
  stream: backendClass.stream || '',
  assignedTeacher: backendClass.teacher_name || '',
  assignedTeacherId: backendClass.assigned_teacher_id,
  maxClassSize: backendClass.max_class_size || 30,
  students: [],
  studentCount: backendClass.student_count || 0,
});

// Helper function to map frontend class to backend format
const mapClassToBackend = (classData: Partial<Class>): any => {
  const out: Record<string, unknown> = {};
  if (classData.className !== undefined) out.class_name = classData.className;
  if (classData.level !== undefined) out.level = classData.level;
  if (classData.stream !== undefined) out.stream = classData.stream;
  if (classData.maxClassSize !== undefined) out.max_class_size = classData.maxClassSize;
  if (classData.assignedTeacherId !== undefined) out.assigned_teacher_id = classData.assignedTeacherId;
  return out;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { schoolId } = useSchool();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [arrearsBalances, setArrearsBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

<<<<<<< HEAD:src/contexts/DataContext.tsx
  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    if (schoolId != null) {
      apiService.setTenantContext(schoolId);
    }
    setLoading(true);
    try {
      const [studentsRes, teachersRes, classesRes, feesRes, paymentsRes, incomeRes, expensesRes, arrearsRes, subjectsRes] = await Promise.all([
        apiService.get('/students').catch(() => []),
        apiService.get('/teachers').catch(() => []),
        apiService.get('/classes').catch(() => []),
        apiService.get('/fees').catch(() => []),
        apiService.get('/payments').catch(() => []),
        apiService.get('/income').catch(() => []),
        apiService.get('/expenses').catch(() => []),
        apiService.get('/fee-calculations/arrears-balances').catch(() => ({})),
        apiService.get('/subjects').catch(() => []),
      ]);

      setStudents((Array.isArray(studentsRes) ? studentsRes : []).map(mapStudent));
      setTeachers((Array.isArray(teachersRes) ? teachersRes : []).map(mapTeacher));
      setClasses((Array.isArray(classesRes) ? classesRes : []).map(mapClass));
      setFeeStructures((Array.isArray(feesRes) ? feesRes : []).map((f: any) => ({
        id: f.id.toString(),
        className: f.class_name || '',
        classId: f.class_id,
        class_id: f.class_id,
        class_name: f.class_name || '',
        term: f.term,
        amount: parseFloat(f.amount),
        dueDate: f.due_date || '',
        description: f.description || '',
      })));
      const rawPayments = Array.isArray(paymentsRes)
        ? paymentsRes
        : (paymentsRes && typeof paymentsRes === 'object' && Array.isArray((paymentsRes as any).data))
          ? (paymentsRes as any).data
          : [];
      setPayments(rawPayments.map((p: any) => ({
        id: (p.id ?? p.payment_id)?.toString() ?? '',
        studentId: (p.student_id ?? p.studentId)?.toString() || '',
        studentIdNum: p.student_id ?? p.studentId,
        amount: parseFloat(p.amount ?? 0),
        date: p.payment_date ?? p.date,
        paymentMethod: p.payment_method ?? p.paymentMethod ?? '',
        term: p.term ?? '',
        notes: p.notes ?? '',
        receiptNumber: p.receipt_number ?? p.receiptNumber,
      })));
      setIncome((Array.isArray(incomeRes) ? incomeRes : []).map((i: any) => ({
        id: i.id.toString(),
        source: i.source,
        amount: parseFloat(i.amount),
        date: i.income_date,
        paymentMethod: i.payment_method || '',
        receivedBy: i.received_by || '',
        notes: i.notes || '',
        description: i.description,
        category: i.category,
      })));
      setArrearsBalances(typeof arrearsRes === 'object' && arrearsRes !== null && !Array.isArray(arrearsRes) ? arrearsRes as Record<string, number> : {});
      setExpenses((Array.isArray(expensesRes) ? expensesRes : []).map((e: any) => ({
        id: e.id.toString(),
        title: e.title,
        category: e.category || '',
        amount: parseFloat(e.amount),
        payeeName: e.payee_name || '',
        paymentDate: e.payment_date,
        paymentMethod: e.payment_method || '',
        purpose: e.purpose || '',
        notes: e.notes || '',
        description: e.description,
        vendor: e.vendor,
      })));
      setSubjects((Array.isArray(subjectsRes) ? subjectsRes : []).map((s: any) => ({
        id: s.id.toString(),
        name: s.name,
        code: s.code,
        level: s.level,
      })));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, schoolId]);
=======
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
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/contexts/DataContext.tsx

  useEffect(() => {
    loadData();
  }, [loadData]);

<<<<<<< HEAD:src/contexts/DataContext.tsx
  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Student functions
  const addStudent = async (studentData: Omit<Student, 'id' | 'studentId' | 'admissionNumber'>) => {
    const backendData = mapStudentToBackend(studentData);
    const result = await apiService.post<any>('/students', backendData);
    await loadData();
    return result?.id ? {
      id: result.id.toString(),
      studentId: result.student_id,
      admissionNumber: result.admission_number,
    } : undefined;
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    const backendData = mapStudentToBackend(updates);
    await apiService.put(`/students/${id}`, backendData);
    await loadData();
  };

  const deleteStudent = async (id: string) => {
    await apiService.delete(`/students/${id}`);
    await loadData();
  };

  // Teacher functions
  const addTeacher = async (teacherData: Omit<Teacher, 'id' | 'staffId'>) => {
    const backendData = mapTeacherToBackend(teacherData);
    const result = await apiService.post<any>('/teachers', backendData);
    await loadData();
    return result ? { loginStaffId: result.loginStaffId, loginPin: result.loginPin, loginMessage: result.loginMessage } : undefined;
  };

  const updateTeacher = async (id: string, updates: Partial<Teacher>) => {
    const backendData = mapTeacherToBackend(updates);
    await apiService.put(`/teachers/${id}`, backendData);
    await loadData();
  };

  const deleteTeacher = async (id: string) => {
    await apiService.delete(`/teachers/${id}`);
    await loadData();
  };

  // Class functions
  const addClass = async (classData: Omit<Class, 'id'>) => {
    const backendData = mapClassToBackend(classData);
    const result = await apiService.post('/classes', backendData);
    await loadData();
  };

  const updateClass = async (id: string, updates: Partial<Class>) => {
    const backendData = mapClassToBackend(updates);
    await apiService.put(`/classes/${id}`, backendData);
    await loadData();
  };

  const deleteClass = async (id: string) => {
    await apiService.delete(`/classes/${id}`);
    await loadData();
  };

  // Fee and Payment functions
  const addFeeStructure = async (feeData: Omit<FeeStructure, 'id'>) => {
    await apiService.post('/fees', {
      class_id: feeData.classId,
      term: feeData.term,
      amount: feeData.amount,
      due_date: feeData.dueDate,
      description: feeData.description,
    });
    await loadData();
  };

  const updateFeeStructure = async (id: string, feeData: Partial<FeeStructure>) => {
    const body: Record<string, unknown> = {};
    if (feeData.classId !== undefined) body.class_id = feeData.classId;
    if (feeData.term !== undefined) body.term = feeData.term;
    if (feeData.amount !== undefined) body.amount = feeData.amount;
    if (feeData.dueDate !== undefined) body.due_date = feeData.dueDate;
    if (feeData.description !== undefined) body.description = feeData.description;
    await apiService.put(`/fees/${id}`, body);
    await loadData();
  };

  const deleteFeeStructure = async (id: string) => {
    await apiService.delete(`/fees/${id}`);
    await loadData();
  };

  const addPayment = async (paymentData: Omit<Payment, 'id'> & { academicYear?: string }): Promise<Payment> => {
    const res = await apiService.post<{
      payment?: { id: number; receipt_number: string; student_id: number; amount: number; payment_date: string; payment_method: string; term: string; notes: string };
      id?: number;
      receipt_number?: string;
      student_id?: number;
      amount?: number;
      payment_date?: string;
      payment_method?: string;
      term?: string;
      notes?: string;
    }>('/payments', {
      student_id: paymentData.studentIdNum || parseInt(paymentData.studentId),
      amount: paymentData.amount,
      payment_date: paymentData.date,
      payment_method: paymentData.paymentMethod,
      term: paymentData.term,
      notes: paymentData.notes,
      academic_year: paymentData.academicYear,
    });
    const created = res.payment || res;
    await loadData();
    return {
      id: created.id.toString(),
      studentId: (created.student_id ?? created.studentId)?.toString() || '',
      studentIdNum: created.student_id ?? created.studentId,
      amount: parseFloat(created.amount ?? 0),
      date: created.payment_date ?? created.date ?? '',
      paymentMethod: created.payment_method ?? created.paymentMethod ?? '',
      term: created.term ?? '',
      notes: created.notes ?? '',
      receiptNumber: created.receipt_number ?? created.receiptNumber,
    };
  };

  // Income and Expense functions
  const addIncome = async (incomeData: Omit<Income, 'id'>) => {
    await apiService.post('/income', {
      source: incomeData.source,
      amount: incomeData.amount,
      income_date: incomeData.date,
      payment_method: incomeData.paymentMethod,
      received_by: incomeData.receivedBy,
      notes: incomeData.notes,
      description: incomeData.description,
      category: incomeData.category,
    });
    await loadData();
  };

  const addExpense = async (expenseData: Omit<Expense, 'id'>) => {
    await apiService.post('/expenses', {
      title: expenseData.title,
      category: expenseData.category,
      amount: expenseData.amount,
      payee_name: expenseData.payeeName,
      payment_date: expenseData.paymentDate,
      payment_method: expenseData.paymentMethod,
      purpose: expenseData.purpose,
      notes: expenseData.notes,
      description: expenseData.description,
      vendor: expenseData.vendor,
    });
    await loadData();
  };

  const addSubject = async (subjectData: Omit<Subject, 'id'>) => {
    await apiService.post('/subjects', subjectData);
    await loadData();
  };

  const updateSubject = async (id: string, subjectData: Partial<Subject>) => {
    await apiService.put(`/subjects/${id}`, subjectData);
    await loadData();
  };

  const deleteSubject = async (id: string) => {
    await apiService.delete(`/subjects/${id}`);
    await loadData();
=======
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
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/contexts/DataContext.tsx
  };

  // Promotion functions
  const promoteStudent = async (studentId: string, newClass: string, currentTerm?: string, academicYear?: string) => {
    const newClassObj = classes.find(c => c.id === newClass || c.className === newClass);
    if (newClassObj) {
      await apiService.post(`/students/${studentId}/promote`, {
        new_class_id: parseInt(newClassObj.id),
        current_term: currentTerm,
        academic_year: academicYear,
      });
      await loadData();
    }
  };

  const promoteClass = async (currentClass: string, newClass: string) => {
    const currentClassObj = classes.find(c => c.id === currentClass || c.className === currentClass);
    const newClassObj = classes.find(c => c.id === newClass || c.className === newClass);
    if (currentClassObj && newClassObj) {
      await apiService.post(`/classes/${currentClassObj.id}/promote`, {
        new_class_id: parseInt(newClassObj.id),
      });
      await loadData();
    }
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
      subjects,
      arrearsBalances,
      loading,
      refresh,
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
      updateFeeStructure,
      deleteFeeStructure,
      addPayment,
      addIncome,
      addExpense,
      addSubject,
      updateSubject,
      deleteSubject,
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
