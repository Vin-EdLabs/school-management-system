
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

  async exportToExcel(data: any[], filename: string, sheetName: string = 'Report') {
    if (data.length === 0) return;
    
    // Create Excel content as CSV format (which Excel can open)
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle different data types
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');
    
    // Create and download Excel file
    const blob = new Blob([csvContent], { 
      type: 'application/vnd.ms-excel;charset=utf-8;' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Legacy CSV method for backward compatibility
  async exportToCSV(data: any[], filename: string) {
    return this.exportToExcel(data, filename.replace('.csv', '.xlsx'));
  }
}

export const reportService = new ReportService();
