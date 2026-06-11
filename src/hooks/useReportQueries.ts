import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { useSchool } from '@/contexts/SchoolContext';

export type FinancialSummaryData = {
  totalExpected: number;
  collected: number;
  outstanding: number;
  netBalance: number;
  systemNetPosition: number;
  otherIncome: number;
  totalExpenses: number;
  collectionRate: number;
  academicYear: string;
  academicYearDisplay: string;
  termLabel: string;
};

export type AdminOverviewData = {
  students: { total: number; male: number; female: number; other: number };
  teachers: { total: number; male: number; female: number };
  classes: { total: number };
  feeStatus: { paid: number; owing: number; noFee: number; credit: number; totalOwing: number };
  enrollmentByClass: { fullName: string; name: string; count: number }[];
  classNames: string[];
};

export type StudentFeeRosterRow = {
  id: number;
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  className: string;
  gender: string;
  enrollmentStatus: string;
  feeStatus: 'Fully Paid' | 'Amount Owing' | 'No Fee Set' | 'Credit Balance';
  balance: number;
};

export type IncomeVsExpenditureRow = {
  name: string;
  income: number;
  expense: number;
};

function enabledForTenant(schoolId: number | null | undefined, active: boolean) {
  return active && schoolId != null;
}

export function useFinancialSummary(active = true) {
  const { schoolId } = useSchool();
  return useQuery({
    queryKey: ['reports', 'financial-summary', schoolId],
    queryFn: () => apiService.get<FinancialSummaryData>('/reports/financial-summary'),
    enabled: enabledForTenant(schoolId, active),
    staleTime: 60_000,
  });
}

export function useAdminOverview(active = true) {
  const { schoolId } = useSchool();
  return useQuery({
    queryKey: ['reports', 'admin-overview', schoolId],
    queryFn: () => apiService.get<AdminOverviewData>('/reports/admin-overview'),
    enabled: enabledForTenant(schoolId, active),
    staleTime: 60_000,
  });
}

export function useIncomeVsExpenditure(active = true) {
  const { schoolId } = useSchool();
  return useQuery({
    queryKey: ['reports', 'income-vs-expenditure', schoolId],
    queryFn: () => apiService.get<IncomeVsExpenditureRow[]>('/reports/income-vs-expenditure'),
    enabled: enabledForTenant(schoolId, active),
    staleTime: 60_000,
  });
}

export function useStudentFeeRoster(
  params: { className?: string; search?: string },
  active = true
) {
  const { schoolId } = useSchool();
  const className = params.className ?? '';
  const search = params.search ?? '';
  return useQuery({
    queryKey: ['reports', 'student-fee-roster', schoolId, className, search],
    queryFn: () => {
      const q = new URLSearchParams();
      if (className && className !== 'all-classes') q.set('className', className);
      if (search.trim()) q.set('search', search.trim());
      const suffix = q.toString() ? `?${q.toString()}` : '';
      return apiService.get<StudentFeeRosterRow[]>(`/reports/student-fee-roster${suffix}`);
    },
    enabled: enabledForTenant(schoolId, active),
    staleTime: 30_000,
  });
}

export function useOutstandingFeesReport(active = true) {
  const { schoolId } = useSchool();
  return useQuery({
    queryKey: ['reports', 'outstanding-fees', schoolId],
    queryFn: () =>
      apiService.get<Array<{ id: number; name: string; class: string; amount: number; days: number }>>(
        '/reports/outstanding-fees'
      ),
    enabled: enabledForTenant(schoolId, active),
    staleTime: 60_000,
  });
}
