
import { apiService } from './api';

export interface ReportData {
  type: 'financial' | 'income' | 'expenses' | 'general';
  term: string;
  year: string;
  date: string;
  reportType?: string;
  financial?: {
    totalFees: number;
    totalOtherIncome: number;
    totalIncome: number;
    totalExpenses: number;
    balance: number;
  };
  students?: {
    total: number;
    owing: number;
    totalOutstanding: number;
  };
  classes?: Array<{
    className: string;
    enrolled: number;
    capacity: number;
    feesCollected: number;
  }>;
  outstandingStudents?: Array<{
    studentName: string;
    className: string;
    totalFee: number;
    paid: number;
    outstanding: number;
  }>;
  expenses?: Record<string, {
    amount: number;
    count: number;
    items: Array<{
      description: string;
      amount: number;
      date: string;
      paymentMethod: string;
    }>;
  }>;
  incomeBreakdown?: Record<string, number>;
  monthlyExpenses?: Record<string, {
    amount: number;
    count: number;
  }>;
  feeIncome?: number;
  otherIncome?: number;
  breakdown?: Record<string, number>;
  byCategory?: Record<string, number>;
  byMonth?: Record<string, number>;
  total?: number;
}

export class ReportService {
  // Future backend integration methods
  async generateFinancialReport(term: string): Promise<ReportData> {
    // This will be used when backend is connected
    return apiService.get<ReportData>(`/reports/financial?term=${term}`);
  }

  async generateIncomeReport(term: string): Promise<ReportData> {
    return apiService.get<ReportData>(`/reports/income?term=${term}`);
  }

  async generateExpenseReport(term: string): Promise<ReportData> {
    return apiService.get<ReportData>(`/reports/expenses?term=${term}`);
  }

  async exportReport(reportData: ReportData, format: 'json' | 'pdf' | 'csv' = 'json'): Promise<Blob> {
    return apiService.post<Blob>('/reports/export', { reportData, format });
  }
}

export const reportService = new ReportService();
