import { apiService } from './api';

export type DailyFeeCoverageStatus = 'covered' | 'expired' | 'never_paid';

export type ClassOverviewReport = {
  class: { id: number; name: string };
  term: { id: number; label: string };
  structure: {
    dailyRate: number;
    weeklyRate: number;
    monthlyRate: number;
    termlyRate: number;
    schoolDaysCount: number;
  } | null;
  summary: {
    totalCollected: number;
    paymentCount: number;
    studentsPaying: number;
    totalStudents: number;
    mostCommonPaymentType: { type: string; label: string; count: number };
    lastCollection: { date: string; studentName: string } | null;
  };
  dailyCollections: Array<{
    date: string;
    total: number;
    studentCount: number;
    byType: { daily: number; weekly: number; monthly: number; termly: number };
  }>;
  paymentTypeBreakdown: Array<{ type: string; label: string; count: number; amount: number }>;
  students: Array<{
    studentId: number;
    studentName: string;
    studentCode: string;
    admissionNumber: string | null;
    totalPaid: number;
    paymentCount: number;
    lastPaymentDate: string | null;
    coverageStatus: DailyFeeCoverageStatus;
    mostUsedType: string | null;
    mostUsedTypeLabel: string | null;
  }>;
};

export type StudentDailyFeeReport = {
  student: {
    id: number;
    fullName: string;
    studentId: string;
    admissionNumber: string | null;
    className: string;
    classId: number | null;
    photoUrl: string | null;
    hasPhoto: boolean;
  };
  term: { id: number; label: string };
  structure: ClassOverviewReport['structure'];
  summary: {
    totalPaid: number;
    paymentCount: number;
    daysCovered: number;
    averagePayment: number;
    nextDueDate: string | null;
    currentStatus: string;
    statusDetail: string;
  };
  paymentTimeline: Array<{
    date: string;
    amount: number;
    cumulative: number;
    paymentType: string;
    paymentTypeLabel: string;
    coverageStart: string;
    coverageEnd: string;
  }>;
  coverageCalendar: Array<{ date: string; status: 'paid' | 'future' | 'unpaid' | 'closed' }>;
  closureDays: string[];
  payments: Array<{
    id: number;
    date: string;
    type: string;
    typeLabel: string;
    amount: number;
    coversFrom: string;
    coversTo: string;
    schoolDays: number;
    method: string;
    receiptNumber: string | null;
  }>;
  accountSummary: {
    termLabel: string;
    totalSchoolDays: number;
    daysCovered: number;
    daysNotCovered: number;
    totalAmountPaid: number;
    rates: { daily: number; weekly: number; monthly: number; termly: number };
    coverageStatusLabel: string;
  };
};

export async function fetchClassOverviewReport(classId: number, termId: number): Promise<ClassOverviewReport> {
  const q = new URLSearchParams({ classId: String(classId), termId: String(termId) });
  return apiService.get<ClassOverviewReport>(`/daily-fees/reports/class-overview?${q}`);
}

export async function fetchStudentDailyFeeReport(
  studentId: number,
  termId: number
): Promise<StudentDailyFeeReport> {
  const q = new URLSearchParams({ studentId: String(studentId), termId: String(termId) });
  return apiService.get<StudentDailyFeeReport>(`/daily-fees/reports/student?${q}`);
}

export const PAYMENT_TYPE_COLORS: Record<string, string> = {
  daily: '#3b82f6',
  weekly: '#22c55e',
  monthly: '#f97316',
  termly: '#a855f7',
};

export function formatGhs(amount: number): string {
  return `GHS ${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
