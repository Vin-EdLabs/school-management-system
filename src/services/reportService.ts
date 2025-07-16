
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
    if (data.length === 0) {
      console.warn('No data to export');
      return;
    }
    
    try {
      // Create Excel content as CSV format (which Excel can open)
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Handle different data types and escape commas
            if (value === null || value === undefined) return '';
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');
      
      // Create and download Excel file
      const blob = new Blob(['\ufeff' + csvContent], { 
        type: 'application/vnd.ms-excel;charset=utf-8;' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`Excel file exported: ${a.download}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw new Error('Failed to export to Excel format');
    }
  }

  // Legacy CSV method for backward compatibility - now exports as Excel
  async exportToCSV(data: any[], filename: string) {
    return this.exportToExcel(data, filename.replace('.csv', '.xlsx'));
  }

  // Export report data specifically formatted for Excel
  async exportReportToExcel(reportData: any, reportType: string) {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${reportType}_report_${timestamp}.xlsx`;
    
    let dataToExport: any[] = [];
    
    switch (reportType) {
      case 'financial':
        if (reportData.transactions && reportData.transactions.length > 0) {
          dataToExport = reportData.transactions;
        } else if (reportData.summary) {
          dataToExport = [reportData.summary];
        }
        break;
      case 'class':
        dataToExport = reportData.classAnalysis || [];
        break;
      case 'outstanding':
        dataToExport = reportData.outstandingBalances || [];
        break;
      case 'complete':
        // For complete reports, create a summary sheet
        dataToExport = [
          {
            'Report Type': 'Complete Financial Report',
            'Generated At': reportData.generatedAt,
            'Term': reportData.term,
            'Total Income': reportData.financial?.totalIncome || 0,
            'Total Expenses': reportData.financial?.totalExpenses || 0,
            'Balance': reportData.financial?.balance || 0,
            'Students with Outstanding': reportData.outstandingBalances?.length || 0
          }
        ];
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
