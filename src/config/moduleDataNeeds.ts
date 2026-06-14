import type { DataDomain } from '@/contexts/DataContext';

/** Domains each app module needs from DataContext. Empty = module fetches its own data. */
export const MODULE_DATA_NEEDS: Record<string, DataDomain[]> = {
  dashboard: [],
  'financial-dashboard': [],
  'teacher-dashboard': [],
  students: ['students', 'classes'],
  teachers: ['teachers', 'classes', 'subjects'],
  classes: ['classes', 'students', 'teachers'],
  subjects: ['subjects'],
  fees: ['fees', 'payments', 'students', 'arrears', 'classes'],
  income: ['income'],
  expenses: ['expenses'],
  payroll: [],
  reports: [],
  'print-fee-status': ['students', 'fees', 'payments', 'arrears', 'classes'],
  transactions: ['payments', 'income', 'expenses', 'students'],
  'manual-adjustments': ['students', 'payments', 'arrears', 'fees'],
  users: [],
  settings: [],
  audit: [],
  records: [],
  calendar: [],
  'support-chat': [],
  'push-notifications': ['students', 'classes'],
  'parent-desk': [],
  'parent-accounts': [],
  'end-of-year': ['students', 'classes'],
  'ai-assistant': ['students', 'teachers', 'payments', 'fees', 'classes', 'income', 'expenses', 'arrears'],
  'teacher-classes': ['students', 'classes'],
  attendance: ['students', 'classes'],
  grades: ['students', 'classes', 'subjects'],
  'teacher-profile': [],
  'teacher-appointment-letters': [],
  'teacher-payment-history': [],
  'teacher-quizzes': ['classes', 'subjects'],
};

export function domainsForModule(moduleId: string): DataDomain[] {
  return MODULE_DATA_NEEDS[moduleId] ?? [];
}
