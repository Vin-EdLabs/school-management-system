
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
    window.print();
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
    <div className="space-y-8">
      {/* Financial Summary */}
      <div className="section">
        <h3 className="section-title">💰 Financial Summary</h3>
        <div className="financial-grid">
          <div className="financial-item">
            <div className="financial-label">Total Fees Collected</div>
            <div className="financial-value">GHS {reportData.financial?.totalFees?.toLocaleString() || '0'}</div>
          </div>
          <div className="financial-item">
            <div className="financial-label">Other Income</div>
            <div className="financial-value">GHS {reportData.financial?.totalIncome?.toLocaleString() || '0'}</div>
          </div>
          <div className="financial-item">
            <div className="financial-label">Total Revenue</div>
            <div className="financial-value">GHS {reportData.financial?.totalRevenue?.toLocaleString() || '0'}</div>
          </div>
          <div className="financial-item">
            <div className="financial-label">Total Expenses</div>
            <div className="financial-value">GHS {reportData.financial?.totalExpenses?.toLocaleString() || '0'}</div>
          </div>
        </div>
        
        <div className="summary-box">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-lg">Net Profit/Loss:</span>
            <span className={`text-xl font-bold ${reportData.financial?.netProfit >= 0 ? 'positive' : 'negative'}`}>
              GHS {reportData.financial?.netProfit?.toLocaleString() || '0'}
            </span>
          </div>
        </div>
      </div>

      {/* Student Statistics */}
      <div className="section">
        <h3 className="section-title">👥 Student Statistics</h3>
        <div className="financial-grid">
          <div className="financial-item">
            <div className="financial-label">Total Students</div>
            <div className="financial-value">{reportData.students?.total || '0'}</div>
          </div>
          <div className="financial-item">
            <div className="financial-label">Students with Outstanding Balance</div>
            <div className="financial-value">{reportData.students?.owing || '0'}</div>
          </div>
          <div className="financial-item">
            <div className="financial-label">Total Outstanding Amount</div>
            <div className="financial-value">GHS {reportData.students?.totalOutstanding?.toLocaleString() || '0'}</div>
          </div>
          <div className="financial-item">
            <div className="financial-label">Collection Rate</div>
            <div className="financial-value">
              {reportData.financial?.totalFees && reportData.students?.totalOutstanding 
                ? ((reportData.financial.totalFees / (reportData.financial.totalFees + reportData.students.totalOutstanding)) * 100).toFixed(1)
                : '0'
              }%
            </div>
          </div>
        </div>
      </div>

      {/* Class Breakdown */}
      {reportData.classes && (
        <div className="section">
          <h3 className="section-title">🏫 Class Breakdown</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>Enrollment</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Fees Collected</TableHead>
                <TableHead>Utilization</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.classes.map((cls: any, index: number) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{cls.className}</TableCell>
                  <TableCell>{cls.enrolled}</TableCell>
                  <TableCell>{cls.capacity}</TableCell>
                  <TableCell>GHS {cls.feesCollected?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={cls.enrolled / cls.capacity > 0.8 ? "default" : "secondary"}>
                      {((cls.enrolled / cls.capacity) * 100).toFixed(0)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Expense Categories */}
      {reportData.expenses && (
        <div className="section">
          <h3 className="section-title">💸 Top Expense Categories</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(reportData.expenses)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .slice(0, 10)
                .map(([category, amount], index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{category}</TableCell>
                    <TableCell>GHS {(amount as number).toLocaleString()}</TableCell>
                    <TableCell>
                      {((amount as number / reportData.financial?.totalExpenses) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">Report Preview</DialogTitle>
            <div className="flex space-x-2 no-print">
              <Button onClick={handlePrint} size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Printer className="w-4 h-4 mr-2" />
                Print A4
              </Button>
              <Button onClick={handleDownload} size="sm" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button onClick={onClose} size="sm" variant="ghost">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div id="printable-report" className="bg-white">
          {/* Report Header */}
          <div className="header text-center border-b-2 border-blue-600 pb-6 mb-8">
            <div className="school-name text-2xl font-bold text-blue-800 mb-2">
              ROSA GARDENS SCHOOL
            </div>
            <div className="report-title text-lg font-semibold text-gray-700 mb-3">
              {reportData.reportType || 'Financial Report'}
            </div>
            <div className="report-meta text-sm text-gray-500">
              <div>Academic Term: {reportData.term || 'Current Term'}</div>
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
      </DialogContent>
    </Dialog>
  );
};

export default A4ReportPrinter;
