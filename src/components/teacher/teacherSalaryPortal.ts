/** Shapes returned by GET /payroll/my-salary (teacher portal). */
export type TeacherPaymentHistoryRow = {
  month: number;
  year: number;
  amountPaid: number;
  grossSalary: number;
  netSalary: number;
  ssnitAmount: number;
  otherDeductions: number;
  allowances: number;
  balanceOwing: number;
  paidDate: string | null;
  paymentMethod: string | null;
  status: string;
};

export type TeacherMySalaryResponse = {
  fullName: string;
  staffId: string;
  monthlySalary: number;
  grossSalary: number;
  currency: string;
  ssnitEnabled?: boolean;
  defaultSsnitPercent?: number;
  ssnitDeduction: number;
  netSalary: number;
  currentMonthStatus: string;
  currentMonthSnapshot?: {
    grossSalary: number;
    ssnitAmount: number;
    netSalary: number;
    amountPaid: number;
    status: string;
    paymentMethod: string | null;
    paidDate: string | null;
  };
  paymentHistory: TeacherPaymentHistoryRow[];
};

export const TEACHER_SALARY_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function formatTeacherMoney(currency: string, value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function salaryStatusBadgeClass(status: string): string {
  if (status === 'Paid') return 'bg-emerald-600 hover:bg-emerald-600 text-white border-transparent';
  if (status === 'Partially Paid') return 'bg-amber-500 hover:bg-amber-500 text-white border-transparent';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
}
