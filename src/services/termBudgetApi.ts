import { apiService } from './api';

export type BudgetCategory = {
  id: number | null;
  name: string;
  type: 'income' | 'expense';
  isSystem: boolean;
  isCustom: boolean;
  hasTransactions: boolean;
};

export type BudgetLine = {
  id?: number;
  categoryName: string;
  categoryType: 'income' | 'expense';
  budgetedAmount: number;
  alertThreshold?: number;
  actualAmount?: number;
  remaining?: number;
  percentageUsed?: number;
  variance?: number;
  alertLevel?: 'none' | 'warning' | 'critical' | 'exceeded';
  alerts?: Array<{ id: number; alertLevel: string; isRead: boolean; message: string }>;
};

export type TermBudgetView = {
  budget: {
    id: number;
    academicYear: string;
    term: string;
    status: string;
    createdAt?: string;
    updatedAt?: string;
  };
  summary: {
    totalBudgetedIncome: number;
    totalActualIncome: number;
    incomeVariance: number;
    totalBudgetedExpense: number;
    totalActualExpense: number;
    expenseVariance: number;
    netBudgetPosition: number;
    netActualPosition: number;
    netVariance: number;
  };
  lines: BudgetLine[];
};

export type SetupPrefill = {
  academicYear: string;
  term: string;
  salaryAutoFill: {
    monthlyTotal: number;
    activeTeachers: number;
    months: number;
    suggestedAmount: number;
    note: string;
  };
  expectedFeeIncome: number;
  incomeLines: BudgetLine[];
  expenseLines: BudgetLine[];
  copyFromLast: boolean;
};

export async function fetchBudgetCategories(type?: 'income' | 'expense'): Promise<BudgetCategory[]> {
  const q = type ? `?type=${type}` : '';
  return apiService.get<BudgetCategory[]>(`/term-budgets/categories${q}`);
}

export async function addBudgetCategory(name: string, type: 'income' | 'expense'): Promise<BudgetCategory> {
  return apiService.post<BudgetCategory>('/term-budgets/categories', { name, type });
}

export async function fetchCurrentBudget(): Promise<TermBudgetView | null> {
  return apiService.get<TermBudgetView | null>('/term-budgets/current');
}

export async function fetchSetupPrefill(copyFromLast: boolean): Promise<SetupPrefill> {
  return apiService.get<SetupPrefill>(`/term-budgets/setup-prefill?copyFromLast=${copyFromLast}`);
}

export async function createTermBudget(lines: BudgetLine[]): Promise<TermBudgetView> {
  return apiService.post<TermBudgetView>('/term-budgets', { lines });
}

export async function updateTermBudgetLines(
  budgetId: number,
  lines: Array<{ id: number; budgetedAmount: number; alertThreshold?: number }>
): Promise<TermBudgetView> {
  return apiService.put<TermBudgetView>(`/term-budgets/${budgetId}/lines`, { lines });
}

export async function closeTermBudget(budgetId: number): Promise<TermBudgetView> {
  return apiService.post<TermBudgetView>(`/term-budgets/${budgetId}/close`, {});
}

export async function fetchBudgetHistory() {
  return apiService.get<Array<Record<string, unknown>>>('/term-budgets/history');
}

export async function fetchUnreadBudgetAlerts() {
  return apiService.get<{ alerts: Array<Record<string, unknown>>; count: number }>('/term-budgets/alerts/unread');
}

export async function markBudgetAlertRead(alertId: number) {
  return apiService.post(`/term-budgets/alerts/${alertId}/read`, {});
}

export async function markAllBudgetAlertsRead() {
  return apiService.post('/term-budgets/alerts/read-all', {});
}
