
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
  classReport: any[];
  outstandingReport: any[];
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
          transactions: [
            ...data.financial.feePayments,
            ...data.financial.currentYearIncome,
            ...data.financial.currentYearExpenses
          ]
        };
      
      case 'class':
        return {
          ...baseReport,
          classAnalysis: data.classReport
        };
      
      case 'outstanding':
        return {
          ...baseReport,
          outstandingBalances: data.outstandingReport
        };
      
      case 'complete':
        return {
          ...baseReport,
          financial: data.financial,
          classAnalysis: data.classReport,
          outstandingBalances: data.outstandingReport
        };
      
      default:
        return baseReport;
    }
  }

  async exportToCSV(data: any[], filename: string) {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => 
          typeof row[header] === 'string' ? `"${row[header]}"` : row[header]
        ).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const reportService = new ReportService();
