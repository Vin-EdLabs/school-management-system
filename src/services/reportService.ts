
import { formatDisplayDate } from '../utils/dateFormat';

export interface ReportData {
  financial: {
    totalFees: number;
    totalOtherIncome: number;
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    feePayments: any[];
    currentYearIncome: any[];
    currentYearExpenses: any[];
  };
  incomeBreakdown?: {
    bySource: Record<string, number>;
    monthly: any[];
    total: number;
  };
  expenseBreakdown?: {
    byCategory: Record<string, any>;
    monthly: any[];
    total: number;
  };
  selectedTerm: string;
}

export class ReportService {
  generateReport(type: string, data: ReportData) {
    const timestamp = new Date().toISOString();
    const baseReport = {
      generatedAt: timestamp,
      term: data.selectedTerm,
      reportType: type
    };

    switch (type) {
      case 'financial':
        return {
          ...baseReport,
          summary: data.financial,
          incomeBreakdown: data.incomeBreakdown,
          expenseBreakdown: data.expenseBreakdown,
          transactions: [
            ...data.financial.feePayments,
            ...data.financial.currentYearIncome,
            ...data.financial.currentYearExpenses
          ]
        };
      
      case 'income':
        return {
          ...baseReport,
          incomeAnalysis: data.incomeBreakdown,
          totalIncome: data.financial.totalIncome
        };
      
      case 'expense':
        return {
          ...baseReport,
          expenseAnalysis: data.expenseBreakdown,
          totalExpenses: data.financial.totalExpenses
        };
      
      case 'summary':
        return {
          ...baseReport,
          executiveSummary: {
            totalIncome: data.financial.totalIncome,
            totalExpenses: data.financial.totalExpenses,
            balance: data.financial.balance,
            topIncomeSource: data.incomeBreakdown ? Object.keys(data.incomeBreakdown.bySource)[0] : 'N/A',
            topExpenseCategory: data.expenseBreakdown ? Object.keys(data.expenseBreakdown.byCategory)[0] : 'N/A'
          }
        };
      
      default:
        return baseReport;
    }
  }

  private buildCsvContent(data: Record<string, unknown>[]): string {
    const headers = Object.keys(data[0]);
    return [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((header) => {
            let value: unknown = row[header];
            if (value === null || value === undefined) return '';
            if (value instanceof Date) {
              value = formatDisplayDate(value);
            } else if (typeof value === 'object') {
              try {
                value = JSON.stringify(value);
              } catch {
                value = '[Complex Object]';
              }
            }
            const stringValue = String(value);
            if (
              stringValue.includes(',') ||
              stringValue.includes('"') ||
              stringValue.includes('\n') ||
              stringValue.includes('\r')
            ) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(',')
      ),
    ].join('\n');
  }

  async exportToCSV(data: any[], filename: string) {
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('No data available for export');
    }
    try {
      const blob = new Blob(['\ufeff' + this.buildCsvContent(data)], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const downloadName = filename.toLowerCase().endsWith('.csv')
        ? filename
        : `${filename.replace(/\.xlsx?$/i, '')}.csv`;
      link.href = url;
      link.download = downloadName;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch {
      throw new Error('Failed to generate CSV file.');
    }
  }

  async exportToExcel(data: any[], filename: string, _sheetName: string = 'Report') {
    return this.exportToCSV(data, filename);
  }

  async exportReportToExcel(reportData: any, reportType: string) {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${reportType}_report_${timestamp}.csv`;
    
    let dataToExport: any[] = [];
    
    switch (reportType) {
      case 'financial':
        if (reportData.transactions && reportData.transactions.length > 0) {
          dataToExport = reportData.transactions;
        } else if (reportData.summary) {
          dataToExport = [reportData.summary];
        }
        break;
      case 'income':
        if (reportData.incomeAnalysis && reportData.incomeAnalysis.monthly) {
          dataToExport = reportData.incomeAnalysis.monthly;
        } else {
          dataToExport = [{ totalIncome: reportData.totalIncome || 0 }];
        }
        break;
      case 'expense':
        if (reportData.expenseAnalysis && reportData.expenseAnalysis.monthly) {
          dataToExport = reportData.expenseAnalysis.monthly;
        } else {
          dataToExport = [{ totalExpenses: reportData.totalExpenses || 0 }];
        }
        break;
      case 'summary':
        dataToExport = [reportData.executiveSummary || reportData];
        break;
      default:
        dataToExport = Array.isArray(reportData) ? reportData : [reportData];
    }
    
    if (dataToExport.length === 0) {
      throw new Error('No data available for export');
    }
    
    await this.exportToExcel(dataToExport, filename, reportType);
  }
}

export const reportService = new ReportService();
