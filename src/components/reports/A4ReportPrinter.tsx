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
              <title>School Report</title>
              <style>
                @page {
                  size: A4 landscape;
                  margin: 1cm 1.5cm;
                }
                body {
                  font-family: 'Arial', sans-serif;
                  line-height: 1.3;
                  color: #333;
                  font-size: 10px;
                  margin: 0;
                  padding: 0;
                  background: white;
                }
                .header {
                  text-align: center;
                  border-bottom: 3px solid #2563eb;
                  padding-bottom: 12px;
                  margin-bottom: 15px;
                  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                  padding: 15px;
                  border-radius: 6px;
                }
                .school-name {
                  font-size: 20px;
                  font-weight: bold;
                  color: #1e40af;
                  margin-bottom: 4px;
                }
                .report-title {
                  font-size: 14px;
                  font-weight: 600;
                  color: #374151;
                  margin-bottom: 6px;
                }
                .report-meta {
                  font-size: 9px;
                  color: #6b7280;
                  display: flex;
                  justify-content: space-around;
                  margin-top: 8px;
                }
                .section {
                  margin-bottom: 16px;
                  page-break-inside: avoid;
                  border: 1px solid #e5e7eb;
                  padding: 12px;
                  border-radius: 6px;
                  background: #fafafa;
                }
                .section-title {
                  font-size: 12px;
                  font-weight: bold;
                  color: #1f2937;
                  border-bottom: 2px solid #3b82f6;
                  padding-bottom: 4px;
                  margin-bottom: 10px;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }
                .financial-grid {
                  display: grid;
                  grid-template-columns: repeat(4, 1fr);
                  gap: 12px;
                  margin-bottom: 12px;
                }
                .financial-item {
                  background: white;
                  padding: 10px;
                  border-radius: 4px;
                  border-left: 3px solid #3b82f6;
                  text-align: center;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .financial-label {
                  font-size: 8px;
                  color: #6b7280;
                  font-weight: 500;
                  text-transform: uppercase;
                  letter-spacing: 0.3px;
                  margin-bottom: 2px;
                }
                .financial-value {
                  font-size: 12px;
                  font-weight: bold;
                  color: #1f2937;
                }
                .positive { color: #059669; }
                .negative { color: #dc2626; }
                .neutral { color: #1f2937; }
                .two-column {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 15px;
                }
                .three-column {
                  display: grid;
                  grid-template-columns: 1fr 1fr 1fr;
                  gap: 12px;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 8px;
                  font-size: 9px;
                  background: white;
                  border-radius: 4px;
                  overflow: hidden;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                th, td {
                  padding: 4px 6px;
                  text-align: left;
                  border-bottom: 1px solid #e5e7eb;
                }
                th {
                  background-color: #f1f5f9;
                  font-weight: 600;
                  color: #374151;
                  font-size: 8px;
                  text-transform: uppercase;
                  letter-spacing: 0.3px;
                }
                .summary-box {
                  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                  border: 1px solid #bfdbfe;
                  border-radius: 6px;
                  padding: 12px;
                  margin: 10px 0;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                }
                .summary-label {
                  font-size: 10px;
                  font-weight: 600;
                  color: #1f2937;
                }
                .summary-value {
                  font-size: 12px;
                  font-weight: bold;
                }
                .income-section {
                  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                  border-left: 4px solid #22c55e;
                }
                .expense-section {
                  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
                  border-left: 4px solid #ef4444;
                }
                .outstanding-section {
                  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                  border-left: 4px solid #f59e0b;
                }
                .expense-item {
                  background: white;
                  padding: 8px;
                  margin: 6px 0;
                  border-radius: 4px;
                  border-left: 2px solid #ef4444;
                  font-size: 8px;
                }
                .expense-title {
                  font-weight: 600;
                  color: #1f2937;
                  margin-bottom: 2px;
                }
                .expense-details {
                  color: #6b7280;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                }
                .footer {
                  position: fixed;
                  bottom: 0.5cm;
                  left: 1.5cm;
                  right: 1.5cm;
                  text-align: center;
                  font-size: 8px;
                  color: #6b7280;
                  border-top: 1px solid #e5e7eb;
                  padding-top: 6px;
                }
                .divider {
                  height: 2px;
                  background: linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6);
                  margin: 15px 0;
                  border-radius: 1px;
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
                School Management System - Comprehensive Financial Report - Generated on ${new Date().toLocaleString()}
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

  if (!reportData) return null;

  const renderGeneralReport = () => (
    <div className="space-y-4">
      {/* Executive Summary */}
      <div className="section">
        <h3 className="section-title">📊 Executive Financial Summary</h3>
        <div className="financial-grid">
          <div className="financial-item">
            <div className="financial-label">School Fees</div>
            <div className="financial-value positive">GHS {(reportData.financial?.totalFees || 0).toLocaleString()}</div>
          </div>
          <div className="financial-item">
            <div className="financial-label">Other Income</div>
            <div className="financial-value positive">GHS {(reportData.financial?.totalIncome || 0).toLocaleString()}</div>
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

      <div className="divider"></div>

      <div className="two-column">
        {/* Detailed Income Analysis */}
        <div className="section income-section">
          <h3 className="section-title">💰 Income Sources</h3>
          
          <div className="summary-box">
            <span className="summary-label">Total Income:</span>
            <span className="summary-value positive">GHS {((reportData.financial?.totalFees || 0) + (reportData.financial?.totalIncome || 0)).toLocaleString()}</span>
          </div>

          {reportData.incomeBreakdown && Object.keys(reportData.incomeBreakdown).length > 0 && (
            <>
              <h4 style={{fontSize: '10px', fontWeight: 600, margin: '12px 0 6px 0', color: '#374151'}}>Other Income Sources</h4>
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Amount</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(reportData.incomeBreakdown)
                    .sort(([,a], [,b]) => (b as number) - (a as number))
                    .map(([source, amount], index) => (
                      <tr key={index}>
                        <td style={{fontWeight: 500}}>{source}</td>
                        <td>GHS {(amount as number).toLocaleString()}</td>
                        <td>{reportData.financial?.totalIncome ? (((amount as number) / reportData.financial.totalIncome) * 100).toFixed(1) : '0'}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Student Statistics */}
        <div className="section">
          <h3 className="section-title">👥 Student Statistics</h3>
          <div className="three-column">
            <div className="financial-item">
              <div className="financial-label">Total Students</div>
              <div className="financial-value neutral">{reportData.students?.total || 0}</div>
            </div>
            <div className="financial-item">
              <div className="financial-label">Students Owing</div>
              <div className="financial-value negative">{reportData.students?.owing || 0}</div>
            </div>
            <div className="financial-item">
              <div className="financial-label">Collection Rate</div>
              <div className="financial-value neutral">
                {reportData.financial?.totalFees && reportData.students?.totalOutstanding 
                  ? (((reportData.financial.totalFees) / (reportData.financial.totalFees + reportData.students.totalOutstanding)) * 100).toFixed(1)
                  : '100'
                }%
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="divider"></div>

      {/* Detailed Expense Analysis */}
      <div className="section expense-section">
        <h3 className="section-title">💸 Detailed Expense Analysis</h3>
        
        <div className="summary-box">
          <span className="summary-label">Total Expenses:</span>
          <span className="summary-value negative">GHS {(reportData.financial?.totalExpenses || 0).toLocaleString()}</span>
        </div>

        {reportData.expenses && Object.keys(reportData.expenses).length > 0 && (
          <div className="two-column">
            <div>
              <h4 style={{fontSize: '10px', fontWeight: 600, margin: '12px 0 6px 0', color: '#374151'}}>Expense Categories</h4>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Count</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(reportData.expenses)
                    .sort(([,a], [,b]) => (b as any).amount - (a as any).amount)
                    .slice(0, 8)
                    .map(([category, data], index) => (
                      <tr key={index}>
                        <td style={{fontWeight: 500}}>{category}</td>
                        <td>GHS {((data as any).amount || 0).toLocaleString()}</td>
                        <td>{((data as any).count || 0)}</td>
                        <td>{reportData.financial?.totalExpenses ? ((((data as any).amount || 0) / reportData.financial.totalExpenses) * 100).toFixed(1) : '0'}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div>
              <h4 style={{fontSize: '10px', fontWeight: 600, margin: '12px 0 6px 0', color: '#374151'}}>Recent Expense Details</h4>
              {Object.entries(reportData.expenses)
                .sort(([,a], [,b]) => (b as any).amount - (a as any).amount)
                .slice(0, 3)
                .map(([category, data]) => (
                  <div key={category}>
                    <div style={{fontSize: '9px', fontWeight: 600, color: '#374151', marginBottom: '4px'}}>{category}</div>
                    {((data as any).items || []).slice(0, 3).map((item: any, idx: number) => (
                      <div key={idx} className="expense-item">
                        <div className="expense-title">{item.description}</div>
                        <div className="expense-details">
                          <span>GHS {item.amount.toLocaleString()}</span>
                          <span>{new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          <span>{item.paymentMethod}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Monthly Expense Trend */}
        {reportData.monthlyExpenses && Object.keys(reportData.monthlyExpenses).length > 0 && (
          <>
            <h4 style={{fontSize: '10px', fontWeight: 600, margin: '12px 0 6px 0', color: '#374151'}}>Monthly Expense Breakdown</h4>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Total Amount</th>
                  <th>Transactions</th>
                  <th>Average/Transaction</th>
                  <th>% of Total</th>
                </tr>
                </thead>
                <tbody>
                  {Object.entries(reportData.monthlyExpenses)
                    .sort(([,a], [,b]) => (b as any).amount - (a as any).amount)
                    .map(([month, data], index) => (
                      <tr key={index}>
                        <td style={{fontWeight: 500}}>{month}</td>
                        <td>GHS {((data as any).amount || 0).toLocaleString()}</td>
                        <td>{((data as any).count || 0)}</td>
                        <td>GHS {((data as any).count > 0 ? ((data as any).amount / (data as any).count) : 0).toLocaleString()}</td>
                        <td>{reportData.financial?.totalExpenses ? ((((data as any).amount || 0) / reportData.financial.totalExpenses) * 100).toFixed(1) : '0'}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}
        </div>

      <div className="divider"></div>

      {/* Outstanding Balances */}
      {reportData.outstandingStudents && reportData.outstandingStudents.length > 0 && (
        <div className="section outstanding-section">
          <h3 className="section-title">⚠️ Outstanding Balances Summary</h3>
          <div className="two-column">
            <div className="summary-box">
              <span className="summary-label">Students with Outstanding Balance:</span>
              <span className="summary-value neutral">{reportData.outstandingStudents.length} students</span>
            </div>
            <div className="summary-box">
              <span className="summary-label">Total Outstanding Amount:</span>
              <span className="summary-value negative">GHS {reportData.outstandingStudents.reduce((sum: number, student: any) => sum + (student.outstanding || 0), 0).toLocaleString()}</span>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Outstanding Entry</th>
                <th>Class</th>
                <th>Total Fee</th>
                <th>Amount Paid</th>
                <th>Outstanding Amount</th>
                <th>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {reportData.outstandingStudents
                .sort((a: any, b: any) => (b.outstanding || 0) - (a.outstanding || 0))
                .slice(0, 15)
                .map((student: any, index: number) => (
                  <tr key={index}>
                    <td style={{fontWeight: 500}}>Outstanding {index + 1}</td>
                    <td>{student.className}</td>
                    <td>GHS {(student.totalFee || 0).toLocaleString()}</td>
                    <td>GHS {(student.paid || 0).toLocaleString()}</td>
                    <td style={{color: '#dc2626', fontWeight: 600}}>GHS {(student.outstanding || 0).toLocaleString()}</td>
                    <td>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '12px',
                        fontSize: '7px',
                        fontWeight: 500,
                        backgroundColor: student.outstanding > 0 ? '#fee2e2' : '#dcfce7',
                        color: student.outstanding > 0 ? '#dc2626' : '#16a34a'
                      }}>
                        {student.outstanding > 0 ? 'PENDING' : 'PAID'}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {reportData.outstandingStudents.length > 15 && (
            <p style={{fontSize: '8px', color: '#6b7280', marginTop: '6px', textAlign: 'center'}}>
              Showing top 15 of {reportData.outstandingStudents.length} students with outstanding balances
            </p>
          )}
        </div>
      )}

      <div className="divider"></div>

      {/* Class Performance */}
      {reportData.classes && reportData.classes.length > 0 && (
        <div className="section">
          <h3 className="section-title">🏫 Class Performance Overview</h3>
          <table>
            <thead>
              <tr>
                <th>Class Name</th>
                <th>Enrolled Students</th>
                <th>Capacity</th>
                <th>Occupancy Rate</th>
                <th>Fees Collected</th>
                <th>Revenue per Student</th>
              </tr>
            </thead>
            <tbody>
              {reportData.classes.map((cls: any, index: number) => (
                <tr key={index}>
                  <td style={{fontWeight: 500}}>{cls.className}</td>
                  <td>{cls.enrolled}</td>
                  <td>{cls.capacity || 'N/A'}</td>
                  <td>{cls.capacity ? ((cls.enrolled / cls.capacity) * 100).toFixed(1) + '%' : 'N/A'}</td>
                  <td>GHS {(cls.feesCollected || 0).toLocaleString()}</td>
                  <td>GHS {cls.enrolled > 0 ? ((cls.feesCollected || 0) / cls.enrolled).toLocaleString() : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
                <TableHead>Recorded Date & Time</TableHead>
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
                    <TableCell>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</TableCell>
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
                <TableHead>Payment Date & Time</TableHead>
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
                    <TableCell>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</TableCell>
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
                <TableHead>Recorded Time</TableHead>
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
                    <TableCell>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</TableCell>
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
      <DialogContent className="max-w-7xl max-h-[95dvh] overflow-hidden flex flex-col">
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
              <div className="report-meta text-sm text-gray-500 flex justify-around">
                <div>Academic Term: {reportData.term || 'Current Term'}</div>
                <div>Report Period: {reportData.year || 'Current Year'}</div>
                <div>Generated: {new Date(reportData.date || Date.now()).toLocaleDateString()} at {new Date(reportData.date || Date.now()).toLocaleTimeString()}</div>
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
