import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Download, X } from 'lucide-react';

interface A4ReportPrinterProps {
  reportData: any;
  show: boolean;
  onClose: () => void;
  onPrint: () => void;
}

const A4ReportPrinter: React.FC<A4ReportPrinterProps> = ({
  reportData,
  show,
  onClose,
  onPrint
}) => {
  const handlePrint = () => {
    const printContent = document.getElementById('printable-report');
    if (printContent) {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Rosa Gardens School Report</title>
              <style>
                @page {
                  size: A4;
                  margin: 1.5cm;
                }
                body {
                  font-family: 'Arial', sans-serif;
                  line-height: 1.4;
                  color: #333;
                  font-size: 11px;
                  margin: 0;
                  padding: 0;
                }
                .header {
                  text-align: center;
                  border-bottom: 3px solid #2563eb;
                  padding-bottom: 15px;
                  margin-bottom: 20px;
                }
                .school-name {
                  font-size: 22px;
                  font-weight: bold;
                  color: #1e40af;
                  margin-bottom: 5px;
                }
                .report-title {
                  font-size: 16px;
                  font-weight: 600;
                  color: #374151;
                  margin-bottom: 8px;
                }
                .report-meta {
                  font-size: 10px;
                  color: #6b7280;
                }
                .section {
                  margin-bottom: 20px;
                  page-break-inside: avoid;
                }
                .section-title {
                  font-size: 14px;
                  font-weight: bold;
                  color: #1f2937;
                  border-bottom: 2px solid #e5e7eb;
                  padding-bottom: 5px;
                  margin-bottom: 12px;
                }
                .financial-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr 1fr;
                  gap: 15px;
                  margin-bottom: 15px;
                }
                .financial-item {
                  background: #f8fafc;
                  padding: 12px;
                  border-radius: 6px;
                  border-left: 3px solid #3b82f6;
                  text-align: center;
                }
                .financial-label {
                  font-size: 9px;
                  color: #6b7280;
                  font-weight: 500;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 3px;
                }
                .financial-value {
                  font-size: 14px;
                  font-weight: bold;
                  color: #1f2937;
                }
                .positive { color: #059669; }
                .negative { color: #dc2626; }
                .neutral { color: #1f2937; }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 10px;
                  font-size: 10px;
                }
                th, td {
                  padding: 6px 8px;
                  text-align: left;
                  border-bottom: 1px solid #e5e7eb;
                }
                th {
                  background-color: #f3f4f6;
                  font-weight: 600;
                  color: #374151;
                  font-size: 9px;
                  text-transform: uppercase;
                  letter-spacing: 0.3px;
                }
                .summary-box {
                  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                  border: 1px solid #bfdbfe;
                  border-radius: 8px;
                  padding: 15px;
                  margin: 15px 0;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                }
                .summary-label {
                  font-size: 14px;
                  font-weight: 600;
                  color: #1f2937;
                }
                .summary-value {
                  font-size: 18px;
                  font-weight: bold;
                }
                .income-section {
                  background: #f0fdf4;
                  border-left: 4px solid #22c55e;
                  padding: 15px;
                  margin: 15px 0;
                  border-radius: 6px;
                }
                .expense-section {
                  background: #fef2f2;
                  border-left: 4px solid #ef4444;
                  padding: 15px;
                  margin: 15px 0;
                  border-radius: 6px;
                }
                .footer {
                  position: fixed;
                  bottom: 1cm;
                  left: 1.5cm;
                  right: 1.5cm;
                  text-align: center;
                  font-size: 9px;
                  color: #6b7280;
                  border-top: 1px solid #e5e7eb;
                  padding-top: 8px;
                }
                @media print {
                  .no-print { display: none !important; }
                  body { print-color-adjust: exact; }
                }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
              <div class="footer">
                Rosa Gardens School Management System - Generated on ${new Date().toLocaleString()}
              </div>
            </body>
          </html>
        `);
        newWindow.document.close();
        setTimeout(() => {
          newWindow.print();
          newWindow.close();
        }, 250);
      }
    }
    onPrint();
  };

  const handleDownload = () => {
    const printContent = document.getElementById('printable-report');
    if (printContent) {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Rosa Gardens School Report</title>
              <style>
                @page {
                  size: A4;
                  margin: 2cm;
                }
                body {
                  font-family: 'Arial', sans-serif;
                  line-height: 1.6;
                  color: #333;
                  font-size: 12px;
                }
                .header {
                  text-align: center;
                  border-bottom: 3px solid #2563eb;
                  padding-bottom: 20px;
                  margin-bottom: 30px;
                }
                .school-name {
                  font-size: 24px;
                  font-weight: bold;
                  color: #1e40af;
                  margin-bottom: 5px;
                }
                .report-title {
                  font-size: 18px;
                  font-weight: 600;
                  color: #374151;
                  margin-bottom: 10px;
                }
                .report-meta {
                  font-size: 11px;
                  color: #6b7280;
                }
                .section {
                  margin-bottom: 25px;
                  page-break-inside: avoid;
                }
                .section-title {
                  font-size: 16px;
                  font-weight: bold;
                  color: #1f2937;
                  border-bottom: 2px solid #e5e7eb;
                  padding-bottom: 8px;
                  margin-bottom: 15px;
                }
                .financial-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 20px;
                  margin-bottom: 20px;
                }
                .financial-item {
                  background: #f8fafc;
                  padding: 15px;
                  border-radius: 8px;
                  border-left: 4px solid #3b82f6;
                }
                .financial-label {
                  font-size: 11px;
                  color: #6b7280;
                  font-weight: 500;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }
                .financial-value {
                  font-size: 16px;
                  font-weight: bold;
                  color: #1f2937;
                  margin-top: 2px;
                }
                .positive { color: #059669; }
                .negative { color: #dc2626; }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 15px;
                }
                th, td {
                  padding: 8px 12px;
                  text-align: left;
                  border-bottom: 1px solid #e5e7eb;
                }
                th {
                  background-color: #f3f4f6;
                  font-weight: 600;
                  color: #374151;
                  font-size: 11px;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }
                td {
                  font-size: 11px;
                }
                .summary-box {
                  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                  border: 1px solid #bfdbfe;
                  border-radius: 12px;
                  padding: 20px;
                  margin: 20px 0;
                }
                .footer {
                  position: fixed;
                  bottom: 1cm;
                  left: 2cm;
                  right: 2cm;
                  text-align: center;
                  font-size: 10px;
                  color: #6b7280;
                  border-top: 1px solid #e5e7eb;
                  padding-top: 10px;
                }
                @media print {
                  .no-print { display: none !important; }
                  body { print-color-adjust: exact; }
                }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
              <div class="footer">
                Rosa Gardens School Management System - Generated on ${new Date().toLocaleString()}
              </div>
            </body>
          </html>
        `);
        newWindow.document.close();
        newWindow.print();
      }
    }
    onPrint();
  };

  if (!reportData) return null;

  const renderGeneralReport = () => (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="section">
        <h3 className="section-title">📊 Executive Summary</h3>
        <div className="financial-grid">
          <div className="financial-item">
            <div className="financial-label">Total Revenue</div>
            <div className="financial-value positive">GHS {((reportData.financial?.totalFees || 0) + (reportData.financial?.totalIncome || 0)).toLocaleString()}</div>
          </div>
          <div className="financial-item">
            <div className="financial-label">Total Expenses</div>
            <div className="financial-value negative">GHS {(reportData.financial?.totalExpenses || 0).toLocaleString()}</div>
          </div>
          <div className="financial-item">
            <div className="financial-label">Net Profit/Loss</div>
            <div className={`financial-value ${((reportData.financial?.totalFees || 0) + (reportData.financial?.totalIncome || 0) - (reportData.financial?.totalExpenses || 0)) >= 0 ? 'positive' : 'negative'}`}>
              GHS {(((reportData.financial?.totalFees || 0) + (reportData.financial?.totalIncome || 0)) - (reportData.financial?.totalExpenses || 0)).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Income Analysis */}
      <div className="section income-section">
        <h3 className="section-title">💰 Detailed Income Analysis</h3>
        
        <div className="summary-box">
          <span className="summary-label">School Fees Collected:</span>
          <span className="summary-value positive">GHS {(reportData.financial?.totalFees || 0).toLocaleString()}</span>
        </div>

        <div className="summary-box">
          <span className="summary-label">Other Income Sources:</span>
          <span className="summary-value positive">GHS {(reportData.financial?.totalIncome || 0).toLocaleString()}</span>
        </div>

        {/* Fee Collection by Class */}
        {reportData.classes && reportData.classes.length > 0 && (
          <>
            <h4 style={{fontSize: '12px', fontWeight: 600, margin: '15px 0 8px 0', color: '#374151'}}>Fee Collection by Class</h4>
            <table>
              <thead>
                <tr>
                  <th>Class Name</th>
                  <th>Students</th>
                  <th>Fees Collected</th>
                  <th>Collection Rate</th>
                </tr>
              </thead>
              <tbody>
                {reportData.classes.map((cls: any, index: number) => (
                  <tr key={index}>
                    <td>{cls.className}</td>
                    <td>{cls.enrolled}</td>
                    <td>GHS {(cls.feesCollected || 0).toLocaleString()}</td>
                    <td>{cls.enrolled > 0 ? ((cls.feesCollected || 0) / cls.enrolled).toFixed(0) : '0'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Other Income Breakdown */}
        {reportData.incomeBreakdown && Object.keys(reportData.incomeBreakdown).length > 0 && (
          <>
            <h4 style={{fontSize: '12px', fontWeight: 600, margin: '15px 0 8px 0', color: '#374151'}}>Other Income Sources</h4>
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Amount</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(reportData.incomeBreakdown)
                  .sort(([,a], [,b]) => (b as number) - (a as number))
                  .map(([source, amount], index) => (
                    <tr key={index}>
                      <td>{source}</td>
                      <td>GHS {(amount as number).toLocaleString()}</td>
                      <td>{reportData.financial?.totalIncome ? (((amount as number) / reportData.financial.totalIncome) * 100).toFixed(1) : '0'}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Detailed Expense Analysis */}
      <div className="section expense-section">
        <h3 className="section-title">💸 Detailed Expense Analysis</h3>
        
        <div className="summary-box">
          <span className="summary-label">Total Expenses:</span>
          <span className="summary-value negative">GHS {(reportData.financial?.totalExpenses || 0).toLocaleString()}</span>
        </div>

        {/* Expense Categories */}
        {reportData.expenseBreakdown && Object.keys(reportData.expenseBreakdown).length > 0 && (
          <>
            <h4 style={{fontSize: '12px', fontWeight: 600, margin: '15px 0 8px 0', color: '#374151'}}>Expenses by Category</h4>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Percentage</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(reportData.expenseBreakdown)
                  .sort(([,a], [,b]) => (b as any).amount - (a as any).amount)
                  .map(([category, data], index) => (
                    <tr key={index}>
                      <td>{category}</td>
                      <td>GHS {((data as any).amount || 0).toLocaleString()}</td>
                      <td>{reportData.financial?.totalExpenses ? ((((data as any).amount || 0) / reportData.financial.totalExpenses) * 100).toFixed(1) : '0'}%</td>
                      <td>{((data as any).count || 0)} items</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}

        {/* Monthly Expense Trend */}
        {reportData.monthlyExpenses && Object.keys(reportData.monthlyExpenses).length > 0 && (
          <>
            <h4 style={{fontSize: '12px', fontWeight: 600, margin: '15px 0 8px 0', color: '#374151'}}>Monthly Expense Trend</h4>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Amount</th>
                  <th>Transactions</th>
                  <th>Average per Transaction</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(reportData.monthlyExpenses)
                  .sort(([,a], [,b]) => (b as any).amount - (a as any).amount)
                  .map(([month, data], index) => (
                    <tr key={index}>
                      <td>{month}</td>
                      <td>GHS {((data as any).amount || 0).toLocaleString()}</td>
                      <td>{((data as any).count || 0)}</td>
                      <td>GHS {((data as any).count > 0 ? ((data as any).amount / (data as any).count) : 0).toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Outstanding Balances */}
      {reportData.outstandingStudents && reportData.outstandingStudents.length > 0 && (
        <div className="section">
          <h3 className="section-title">⚠️ Outstanding Balances</h3>
          <div className="summary-box">
            <span className="summary-label">Students with Outstanding Balance:</span>
            <span className="summary-value neutral">{reportData.outstandingStudents.length} students</span>
          </div>
          <div className="summary-box">
            <span className="summary-label">Total Outstanding Amount:</span>
            <span className="summary-value negative">GHS {reportData.outstandingStudents.reduce((sum: number, student: any) => sum + (student.outstanding || 0), 0).toLocaleString()}</span>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Class</th>
                <th>Total Fee</th>
                <th>Paid</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {reportData.outstandingStudents
                .sort((a: any, b: any) => (b.outstanding || 0) - (a.outstanding || 0))
                .slice(0, 20)
                .map((student: any, index: number) => (
                  <tr key={index}>
                    <td>{student.studentName}</td>
                    <td>{student.className}</td>
                    <td>GHS {(student.totalFee || 0).toLocaleString()}</td>
                    <td>GHS {(student.paid || 0).toLocaleString()}</td>
                    <td style={{color: '#dc2626', fontWeight: 600}}>GHS {(student.outstanding || 0).toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {reportData.outstandingStudents.length > 20 && (
            <p style={{fontSize: '10px', color: '#6b7280', marginTop: '8px', textAlign: 'center'}}>
              Showing top 20 of {reportData.outstandingStudents.length} students with outstanding balances
            </p>
          )}
        </div>
      )}

      {/* Performance Metrics */}
      <div className="section">
        <h3 className="section-title">📈 Performance Metrics</h3>
        <div className="financial-grid">
          <div className="financial-item">
            <div className="financial-label">Revenue per Student</div>
            <div className="financial-value neutral">
              GHS {reportData.students?.total > 0 ? (((reportData.financial?.totalFees || 0) + (reportData.financial?.totalIncome || 0)) / reportData.students.total).toLocaleString() : '0'}
            </div>
          </div>
          <div className="financial-item">
            <div className="financial-label">Expense per Student</div>
            <div className="financial-value neutral">
              GHS {reportData.students?.total > 0 ? ((reportData.financial?.totalExpenses || 0) / reportData.students.total).toLocaleString() : '0'}
            </div>
          </div>
          <div className="financial-item">
            <div className="financial-label">Fee Collection Rate</div>
            <div className="financial-value neutral">
              {reportData.financial?.totalFees && reportData.students?.totalOutstanding 
                ? (((reportData.financial.totalFees) / (reportData.financial.totalFees + reportData.students.totalOutstanding)) * 100).toFixed(1)
                : '0'
              }%
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderIncomeReport = () => (
    <div className="space-y-8">
      <div className="section">
        <h3 className="section-title">💹 Income Summary</h3>
        <div className="financial-grid">
          <div className="financial-item">
            <div className="financial-label">School Fees</div>
            <div className="financial-value">GHS {reportData.feeIncome?.toLocaleString() || '0'}</div>
          </div>
          <div className="financial-item">
            <div className="financial-label">Other Income</div>
            <div className="financial-value">GHS {reportData.otherIncome?.toLocaleString() || '0'}</div>
          </div>
        </div>
        
        <div className="summary-box">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-lg">Total Income:</span>
            <span className="text-xl font-bold positive">
              GHS {((reportData.feeIncome || 0) + (reportData.otherIncome || 0)).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {reportData.breakdown && Object.keys(reportData.breakdown).length > 0 && (
        <div className="section">
          <h3 className="section-title">📋 Income Sources Breakdown</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(reportData.breakdown)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .map(([source, amount], index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{source}</TableCell>
                    <TableCell>GHS {(amount as number).toLocaleString()}</TableCell>
                    <TableCell>
                      {((amount as number / reportData.otherIncome) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  const renderExpenseReport = () => (
    <div className="space-y-8">
      <div className="section">
        <h3 className="section-title">💸 Expense Summary</h3>
        <div className="financial-grid">
          <div className="financial-item">
            <div className="financial-label">Total Expenses</div>
            <div className="financial-value">GHS {reportData.total?.toLocaleString() || '0'}</div>
          </div>
          <div className="financial-item">
            <div className="financial-label">Average Monthly</div>
            <div className="financial-value">GHS {((reportData.total || 0) / 12).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {reportData.byCategory && (
        <div className="section">
          <h3 className="section-title">📊 Expenses by Category</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(reportData.byCategory)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .map(([category, amount], index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{category}</TableCell>
                    <TableCell>GHS {(amount as number).toLocaleString()}</TableCell>
                    <TableCell>
                      {((amount as number / reportData.total) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}

      {reportData.byMonth && (
        <div className="section">
          <h3 className="section-title">📅 Monthly Expenses</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(reportData.byMonth)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .map(([month, amount], index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{month}</TableCell>
                    <TableCell>GHS {(amount as number).toLocaleString()}</TableCell>
                    <TableCell>
                      {((amount as number / reportData.total) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">📊 Comprehensive School Report</DialogTitle>
            <div className="flex space-x-2 no-print">
              <Button onClick={handlePrint} size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Printer className="w-4 h-4 mr-2" />
                Print Report
              </Button>
              <Button onClick={onClose} size="sm" variant="ghost">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div id="printable-report" className="bg-white p-6">
            {/* Report Header */}
            <div className="header text-center border-b-2 border-blue-600 pb-6 mb-8">
              <div className="school-name text-2xl font-bold text-blue-800 mb-2">
                ROSA GARDENS SCHOOL
              </div>
              <div className="report-title text-lg font-semibold text-gray-700 mb-3">
                {reportData.reportType || 'Comprehensive Financial Report'}
              </div>
              <div className="report-meta text-sm text-gray-500">
                <div>Academic Term: {reportData.term || 'Current Term'}</div>
                <div>Report Period: {reportData.period || 'Full Academic Year'}</div>
                <div>Generated on: {new Date(reportData.date || Date.now()).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Report Content */}
            <div className="report-content">
              {reportData.type === 'income' && renderIncomeReport()}
              {reportData.type === 'expenses' && renderExpenseReport()}
              {(!reportData.type || reportData.type === 'general') && renderGeneralReport()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default A4ReportPrinter;
