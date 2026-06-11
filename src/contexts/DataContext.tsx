
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import { useSchool } from './SchoolContext';
import { useSocket } from './SocketContext';
import { mapStudent, mapStudentToBackend } from '@/utils/studentMappers';
import {
  appendStudentToCache,
  bindStudentsStateSync,
  removeStudentFromCache,
  replaceStudentInCache,
  setStudentsCache,
  studentsQueryKeys,
} from '@/hooks/useStudentCache';

export interface Student {
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
  numberOfSiblings: number;
  namesOfSiblings: string;
  previousSchool: string;
  dateOfAdmission: string;
  notes: string;
  passportPhotoUrl?: string;
  /** True when a photo exists on the server (list API omits the image bytes). */
  hasPassportPhoto?: boolean;
  isBeneficiary?: boolean;
  beneficiaryType?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  beneficiaryNotes?: string;
  /** active | graduated | suspended (and custom values from DB) */
  enrollmentStatus?: string;
  /** Set when student is alumni (from graduation_details). */
  graduatedAt?: string;
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

export interface FeeStructure {
  id: string;
  className: string;
  classId?: number;
  term: string;
  amount: number;
  dueDate: string;
  description: string;
}

export interface Payment {
  id: string;
  studentId: string;
  studentIdNum?: number;
  amount: number;
  date: string;
  recordedAt?: string;
  paymentMethod: string;
  term: string;
  notes: string;
  receiptNumber?: string;
  /** Frozen at payment time — do not recompute from live balances for receipts */
  receiptSnapshot?: {
    totalDue: number;
    termFee: number;
    arrears: number;
    balanceAfter: number;
    credit?: number;
  };
}

interface Income {
  id: string;
  source: string;
  amount: number;
  date: string;
  recordedAt?: string;
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
  recordedAt?: string;
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

export type DataDomain =
  | 'students'
  | 'teachers'
  | 'classes'
  | 'fees'
  | 'payments'
  | 'income'
  | 'expenses'
  | 'arrears'
  | 'subjects';

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
  loadDomains: (domains: DataDomain[], options?: { silent?: boolean; force?: boolean }) => Promise<void>;
  refresh: (domains?: DataDomain[]) => Promise<void>;
  addStudent: (student: Omit<Student, 'id' | 'studentId' | 'admissionNumber'>) => Promise<{ id: string; studentId: string; admissionNumber: string } | void>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  setStudentStatus: (id: string, status: 'active' | 'inactive') => Promise<void>;
  applyPaymentLocally: (
    payment: Payment,
    amount: number,
    balance?: { outstanding?: number; arrears?: number; credit?: number }
  ) => string;
  revertPaymentLocally: (token: string) => void;
  addTeacher: (teacher: Omit<Teacher, 'id' | 'staffId'>) => Promise<{ loginStaffId?: string; loginPin?: string; loginMessage?: string } | void>;
  updateTeacher: (id: string, updates: Partial<Teacher>) => Promise<void>;
  deleteTeacher: (id: string) => Promise<void>;
  addClass: (classData: Omit<Class, 'id'>) => Promise<void>;
  updateClass: (id: string, updates: Partial<Class>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  addFeeStructure: (fee: Omit<FeeStructure, 'id'>) => Promise<void>;
  updateFeeStructure: (id: string, fee: Partial<FeeStructure>) => Promise<void>;
  deleteFeeStructure: (id: string) => Promise<void>;
  addPayment: (payment: Omit<Payment, 'id'> & { academicYear?: string }) => Promise<{
    payment: Payment;
    balance?: {
      totalFees: number;
      totalPaid: number;
      outstanding: number;
      arrears: number;
      credit: number;
      status: string;
    }
  }>;
  addIncome: (income: Omit<Income, 'id'>) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  addSubject: (subject: Omit<Subject, 'id'>) => Promise<void>;
  updateSubject: (id: string, subject: Partial<Subject>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  promoteStudent: (studentId: string, newClass: string, currentTerm?: string, academicYear?: string) => Promise<void>;
  promoteClass: (currentClass: string, newClass: string) => Promise<void>;
  graduateClassToAlumni: (currentClass: string) => Promise<{ graduated: number }>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Helper to format dates to YYYY-MM-DD for HTML date inputs
const formatDateForInput = (date: any): string => {
  if (!date) return '';
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

// Helper function to map backend teacher to frontend format
const mapTeacher = (backendTeacher: any): Teacher => ({
  id: backendTeacher.id.toString(),
  fullName: backendTeacher.full_name,
  gender: backendTeacher.gender || '',
  dateOfBirth: formatDateForInput(backendTeacher.date_of_birth),
  staffId: backendTeacher.staff_id,
  phoneNumber: backendTeacher.phone_number || '',
  email: backendTeacher.email || '',
  address: backendTeacher.address || '',
  subjectsTaught: backendTeacher.subjects_taught || [],
  classAssigned: backendTeacher.class_name || '',
  classAssignedId: backendTeacher.class_assigned_id,
  employmentDate: formatDateForInput(backendTeacher.employment_date),
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
  className: backendClass.class_name || backendClass.name || '',
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
  if ((classData as { isFinalClass?: boolean }).isFinalClass !== undefined) {
    out.is_final_class = (classData as { isFinalClass?: boolean }).isFinalClass;
  }
  return out;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { schoolId } = useSchool();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [arrearsBalances, setArrearsBalances] = useState<Record<string, number>>({});
  const paymentRollbackRef = useRef<Map<string, { payments: Payment[]; arrears: Record<string, number> }>>(new Map());
  const arrearsBalancesRef = useRef<Record<string, number>>({});
  useEffect(() => {
    arrearsBalancesRef.current = arrearsBalances;
  }, [arrearsBalances]);
  const [loading, setLoading] = useState(false);
  const loadedDomainsRef = useRef<Set<DataDomain>>(new Set());
  const inFlightRef = useRef<Set<DataDomain>>(new Set());
  const loadGeneration = useRef(0);
  const skipStudentSocketRefreshUntil = useRef(0);

  const markStudentMutation = useCallback(() => {
    skipStudentSocketRefreshUntil.current = Date.now() + 4000;
  }, []);

  useEffect(() => {
    bindStudentsStateSync(setStudents);
    return () => bindStudentsStateSync(null);
  }, []);

  const clearAllData = useCallback(() => {
    loadedDomainsRef.current = new Set();
    inFlightRef.current = new Set();
    setStudents([]);
    setTeachers([]);
    setClasses([]);
    setFeeStructures([]);
    setPayments([]);
    setIncome([]);
    setExpenses([]);
    setSubjects([]);
    setArrearsBalances({});
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || schoolId == null) {
      clearAllData();
      return;
    }
    clearAllData();
    apiService.setTenantContext(schoolId);
  }, [isAuthenticated, schoolId, clearAllData]);

  const fetchDomain = useCallback(async (domain: DataDomain) => {
    switch (domain) {
      case 'students': {
        const studentsRes = await apiService.get('/students?status=all').catch(() => []);
        const mapped = (Array.isArray(studentsRes) ? studentsRes : []).map(mapStudent);
        setStudents(mapped);
        setStudentsCache(queryClient, schoolId, mapped);
        break;
      }
      case 'teachers': {
        const teachersRes = await apiService.get('/teachers').catch(() => []);
        setTeachers((Array.isArray(teachersRes) ? teachersRes : []).map(mapTeacher));
        break;
      }
      case 'classes': {
        const classesRes = await apiService.get('/classes').catch(() => []);
        setClasses((Array.isArray(classesRes) ? classesRes : []).map(mapClass));
        break;
      }
      case 'fees': {
        const feesRes = await apiService.get('/fees').catch(() => []);
        setFeeStructures((Array.isArray(feesRes) ? feesRes : []).map((f: any) => ({
          id: f.id.toString(),
          className: f.class_name || '',
          classId: f.class_id,
          class_id: f.class_id,
          class_name: f.class_name || '',
          term: f.term,
          amount: parseFloat(f.amount),
          dueDate: formatDateForInput(f.due_date),
          description: f.description || '',
        })));
        break;
      }
      case 'payments': {
        const paymentsRes = await apiService.get('/payments').catch(() => []);
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
          date: formatDateForInput(p.payment_date ?? p.date),
          recordedAt: p.created_at ?? p.recorded_at ?? p.payment_date ?? p.date,
          paymentMethod: p.payment_method ?? p.paymentMethod ?? '',
          term: p.term ?? '',
          notes: p.notes ?? '',
          receiptNumber: p.receipt_number ?? p.receiptNumber,
          receiptSnapshot: p.receipt_snapshot ?? p.receiptSnapshot ?? undefined,
        })));
        break;
      }
      case 'income': {
        const incomeRes = await apiService.get('/income').catch(() => []);
        setIncome((Array.isArray(incomeRes) ? incomeRes : []).map((i: any) => ({
          id: i.id.toString(),
          source: i.source,
          amount: parseFloat(i.amount),
          date: formatDateForInput(i.income_date),
          recordedAt: i.created_at ?? i.recorded_at ?? i.income_date,
          paymentMethod: i.payment_method || '',
          receivedBy: i.received_by || '',
          notes: i.notes || '',
          description: i.description,
          category: i.category,
        })));
        break;
      }
      case 'expenses': {
        const expensesRes = await apiService.get('/expenses').catch(() => []);
        setExpenses((Array.isArray(expensesRes) ? expensesRes : []).map((e: any) => ({
          id: e.id.toString(),
          title: e.title,
          category: e.category || '',
          amount: parseFloat(e.amount),
          payeeName: e.payee_name || '',
          paymentDate: formatDateForInput(e.payment_date),
          recordedAt: e.created_at ?? e.recorded_at ?? e.payment_date,
          paymentMethod: e.payment_method || '',
          purpose: e.purpose || '',
          notes: e.notes || '',
          description: e.description,
          vendor: e.vendor,
        })));
        break;
      }
      case 'arrears': {
        const arrearsRes = await apiService.get('/fee-calculations/arrears-balances').catch(() => ({}));
        setArrearsBalances(
          typeof arrearsRes === 'object' && arrearsRes !== null && !Array.isArray(arrearsRes)
            ? (arrearsRes as Record<string, number>)
            : {}
        );
        break;
      }
      case 'subjects': {
        const subjectsRes = await apiService.get('/subjects').catch(() => []);
        setSubjects((Array.isArray(subjectsRes) ? subjectsRes : []).map((s: any) => ({
          id: s.id.toString(),
          name: s.name,
          code: s.code,
          level: s.level,
        })));
        break;
      }
      default:
        break;
    }
  }, [queryClient, schoolId]);

  const loadDomains = useCallback(
    async (domains: DataDomain[], options?: { silent?: boolean; force?: boolean }) => {
      if (!isAuthenticated || schoolId == null || domains.length === 0) return;
      apiService.setTenantContext(schoolId);

      const unique = Array.from(new Set(domains));
      const toLoad = unique.filter((domain) => {
        if (options?.force) return true;
        if (inFlightRef.current.has(domain)) return false;
        return !loadedDomainsRef.current.has(domain);
      });
      if (toLoad.length === 0) return;

      const gen = ++loadGeneration.current;
      toLoad.forEach((domain) => inFlightRef.current.add(domain));
      if (!options?.silent) setLoading(true);

      try {
        await Promise.all(
          toLoad.map(async (domain) => {
            await fetchDomain(domain);
            loadedDomainsRef.current.add(domain);
          })
        );
      } catch (error) {
        console.error('Error loading domains:', error);
      } finally {
        toLoad.forEach((domain) => inFlightRef.current.delete(domain));
        if (gen === loadGeneration.current) {
          setLoading(false);
        }
      }
    },
    [fetchDomain, isAuthenticated, schoolId]
  );

  const refresh = useCallback(
    async (domains?: DataDomain[]) => {
      const target =
        domains && domains.length > 0
          ? domains
          : Array.from(loadedDomainsRef.current);
      if (target.length === 0) return;
      await loadDomains(target, { force: true });
    },
    [loadDomains]
  );

  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const entityDomains: Record<string, DataDomain[]> = {
      student: ['students', 'classes'],
      teacher: ['teachers'],
      class: ['classes', 'students'],
      fee: ['fees'],
      payment: ['payments', 'arrears'],
      income: ['income'],
      expense: ['expenses'],
      subject: ['subjects'],
    };

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshNow = (payload?: { entity?: string }) => {
      if (payload?.entity === 'payment') return;
      const entity = String(payload?.entity || '').toLowerCase();
      if (entity === 'student' && Date.now() < skipStudentSocketRefreshUntil.current) return;
      const domains = entityDomains[entity]?.filter((d) => loadedDomainsRef.current.has(d)) ?? [];
      if (domains.length === 0) return;
      if (debounceTimer != null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        void loadDomains(domains, { silent: true, force: true });
      }, 120);
    };

    socket.on('tenant-data-changed', refreshNow);
    return () => {
      if (debounceTimer != null) clearTimeout(debounceTimer);
      socket.off('tenant-data-changed', refreshNow);
    };
  }, [socket, isAuthenticated, loadDomains]);

  // Student functions
  const addStudent = async (studentData: Omit<Student, 'id' | 'studentId' | 'admissionNumber'>) => {
    markStudentMutation();
    const optimisticId = `optimistic-${Date.now()}`;
    const className =
      studentData.classAssigned ||
      classes.find((c) => c.id === String(studentData.classAssignedId))?.className ||
      '';

    const optimisticStudent: Student = {
      ...studentData,
      id: optimisticId,
      studentId: '…',
      admissionNumber: '…',
      classAssigned: className,
      enrollmentStatus: studentData.enrollmentStatus || 'active',
    };

    const previousStudents = students;
    appendStudentToCache(queryClient, schoolId, optimisticStudent);

    try {
      const backendData = mapStudentToBackend(studentData);
      const result = await apiService.post<Record<string, unknown>>('/students', backendData);
      const newStudent = mapStudent(result);
      replaceStudentInCache(queryClient, schoolId, optimisticId, newStudent);
      return {
        id: newStudent.id,
        studentId: newStudent.studentId,
        admissionNumber: newStudent.admissionNumber,
      };
    } catch (error) {
      removeStudentFromCache(queryClient, schoolId, optimisticId);
      setStudents(previousStudents);
      setStudentsCache(queryClient, schoolId, previousStudents);
      throw error;
    }
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    markStudentMutation();
    const previousStudents = students;
    const existing = students.find((s) => s.id === id);
    if (!existing) {
      throw new Error('Student not found');
    }

    const { passportPhotoUrl: _photo, ...rest } = updates;
    const optimisticStudent: Student = { ...existing, ...rest };
    replaceStudentInCache(queryClient, schoolId, id, optimisticStudent);

    try {
      const backendData = mapStudentToBackend(rest);
      await apiService.put(`/students/${id}`, backendData);
      const fresh = await apiService.get<Record<string, unknown>>(`/students/${id}`);
      const mapped = mapStudent(fresh);
      replaceStudentInCache(queryClient, schoolId, id, mapped);
      queryClient.setQueryData(studentsQueryKeys.detail(schoolId, id), mapped);
    } catch (error) {
      setStudents(previousStudents);
      setStudentsCache(queryClient, schoolId, previousStudents);
      throw error;
    }
  };

  const setStudentStatus = async (id: string, status: 'active' | 'inactive') => {
    await apiService.patch(`/students/${id}/status`, { status });
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enrollmentStatus: status } : s))
    );
  };

  const applyPaymentLocally = (
    payment: Payment,
    _amount: number,
    balance?: { outstanding?: number; arrears?: number; credit?: number }
  ): string => {
    const token = `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPayments((prev) => {
      paymentRollbackRef.current.set(token, {
        payments: prev,
        arrears: { ...arrearsBalancesRef.current },
      });
      const withoutDup = prev.filter((p) => p.id !== payment.id && !p.id.startsWith('optimistic-'));
      return [payment, ...withoutDup];
    });
    if (balance?.arrears !== undefined) {
      setArrearsBalances((prev) => ({
        ...prev,
        [payment.studentId]: balance.arrears!,
      }));
    }
    return token;
  };

  const revertPaymentLocally = (token: string) => {
    const snapshot = paymentRollbackRef.current.get(token);
    if (!snapshot) return;
    setPayments(snapshot.payments);
    setArrearsBalances(snapshot.arrears);
    paymentRollbackRef.current.delete(token);
  };

  // Teacher functions
  const addTeacher = async (teacherData: Omit<Teacher, 'id' | 'staffId'>) => {
    const backendData = mapTeacherToBackend(teacherData);
    const result = await apiService.post<any>('/teachers', backendData);
    await refresh(['teachers']);
  };

  const updateTeacher = async (id: string, updates: Partial<Teacher>) => {
    const backendData = mapTeacherToBackend(updates);
    await apiService.put(`/teachers/${id}`, backendData);
    await refresh(['teachers']);
  };

  const deleteTeacher = async (id: string) => {
    await apiService.delete(`/teachers/${id}`);
    await refresh(['teachers']);
  };

  // Class functions
  const addClass = async (classData: Omit<Class, 'id'>) => {
    const backendData = mapClassToBackend(classData);
    await refresh(['classes']);
  };

  const updateClass = async (id: string, updates: Partial<Class>) => {
    const backendData = mapClassToBackend(updates);
    await apiService.put(`/classes/${id}`, backendData);
    await refresh(['classes']);
  };

  const deleteClass = async (id: string) => {
    await apiService.delete(`/classes/${id}`);
    await refresh(['classes', 'students']);
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
    await refresh(['fees']);
  };

  const updateFeeStructure = async (id: string, feeData: Partial<FeeStructure>) => {
    const body: Record<string, unknown> = {};
    if (feeData.classId !== undefined) body.class_id = feeData.classId;
    if (feeData.term !== undefined) body.term = feeData.term;
    if (feeData.amount !== undefined) body.amount = feeData.amount;
    if (feeData.dueDate !== undefined) body.due_date = feeData.dueDate;
    if (feeData.description !== undefined) body.description = feeData.description;
    await apiService.put(`/fees/${id}`, body);
    await refresh(['fees']);
  };

  const deleteFeeStructure = async (id: string) => {
    await apiService.delete(`/fees/${id}`);
    await refresh(['fees']);
  };

  const addPayment = async (paymentData: Omit<Payment, 'id'> & { academicYear?: string }): Promise<{ payment: Payment; balance?: any }> => {
    const res = await apiService.post<{
      payment?: { id: number; receipt_number: string; student_id: number; amount: number; payment_date: string; payment_method: string; term: string; notes: string; receipt_snapshot?: Payment['receiptSnapshot'] };
      balance?: any;
      id?: number;
      receipt_number?: string;
      student_id?: number;
      amount?: number;
      payment_date?: string;
      payment_method?: string;
      term?: string;
      notes?: string;
      receipt_snapshot?: Payment['receiptSnapshot'];
    }>('/payments', {
      student_id: paymentData.studentIdNum || parseInt(paymentData.studentId),
      amount: paymentData.amount,
      payment_date: paymentData.date,
      payment_method: paymentData.paymentMethod,
      term: paymentData.term,
      notes: paymentData.notes,
      academic_year: paymentData.academicYear,
    });
    const created = (res.payment || res) as any;
    const payment: Payment = {
      id: created.id.toString(),
      studentId: (created.student_id || created.studentId)?.toString() || paymentData.studentId,
      studentIdNum: created.student_id || created.studentId,
      amount: parseFloat(created.amount ?? 0),
      date: created.payment_date || created.date || '',
      paymentMethod: created.payment_method || created.paymentMethod || '',
      term: created.term ?? '',
      notes: created.notes ?? '',
      receiptNumber: created.receipt_number || created.receiptNumber,
      receiptSnapshot: created.receipt_snapshot ?? created.receiptSnapshot,
    };
    applyPaymentLocally(payment, paymentData.amount, res.balance);
    return { payment, balance: res.balance };
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
    await refresh(['income']);
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
    await refresh(['expenses']);
  };

  const addSubject = async (subjectData: Omit<Subject, 'id'>) => {
    await apiService.post('/subjects', subjectData);
    await refresh(['subjects']);
  };

  const updateSubject = async (id: string, subjectData: Partial<Subject>) => {
    await apiService.put(`/subjects/${id}`, subjectData);
    await refresh(['subjects']);
  };

  const deleteSubject = async (id: string) => {
    await apiService.delete(`/subjects/${id}`);
    await refresh(['subjects']);
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
      await refresh(['students', 'classes']);
    }
  };

  const promoteClass = async (currentClass: string, newClass: string) => {
    const currentClassObj = classes.find(c => c.id === currentClass || c.className === currentClass);
    const newClassObj = classes.find(c => c.id === newClass || c.className === newClass);
    if (currentClassObj && newClassObj) {
      await apiService.post(`/classes/${currentClassObj.id}/promote`, {
        new_class_id: parseInt(newClassObj.id),
      });
      await refresh(['students', 'classes']);
    }
  };

  const graduateClassToAlumni = async (currentClass: string) => {
    const currentClassObj = classes.find(c => c.id === currentClass || c.className === currentClass);
    if (!currentClassObj) {
      throw new Error('Class not found');
    }
    const result = await apiService.post<{ graduated: number; message: string }>(
      `/classes/${currentClassObj.id}/graduate-to-alumni`,
      {}
    );
    await refresh(['students', 'classes']);
    return { graduated: result.graduated ?? 0 };
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
      loadDomains,
      refresh,
      addStudent,
      updateStudent,
      setStudentStatus,
      applyPaymentLocally,
      revertPaymentLocally,
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
      promoteClass,
      graduateClassToAlumni
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
