
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Printer } from 'lucide-react';

interface ReceiptData {
  studentName: string;
  studentId: string;
  className: string;
  amount: number;
  date: string;
  paymentMethod: string;
  term: string;
  year?: string;
  receiptNumber: string;
  notes?: string;
  remainingBalance?: number;
  creditBalance?: number;
  arrears?: number;
  currentTermFee?: number;
  totalAmountDue?: number;
}

interface ReceiptPrinterProps {
  receiptData: ReceiptData;
  onPrint: () => void;
  show: boolean;
  onClose: () => void;
}

const ReceiptPrinter: React.FC<ReceiptPrinterProps> = ({ receiptData, onPrint, show, onClose }) => {
  if (!show) return null;

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-content');
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Payment Receipt - ${receiptData.receiptNumber}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .receipt { max-width: 400px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 20px; }
                .logo { width: 60px; height: 60px; margin: 0 auto 10px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 20px; }
                .school-name { font-size: 24px; font-weight: bold; color: #1f2937; }
                .school-address { font-size: 14px; color: #6b7280; margin-top: 5px; }
                .receipt-title { font-size: 18px; font-weight: bold; margin: 20px 0; text-align: center; background: #f3f4f6; padding: 10px; border: 2px solid #e5e7eb; }
                .receipt-info { margin: 10px 0; }
                .info-row { display: flex; justify-content: space-between; margin: 8px 0; }
                .info-label { font-weight: bold; }
                .amount { font-size: 20px; font-weight: bold; color: #059669; }
                .balance { font-size: 16px; font-weight: bold; color: #dc2626; }
                .credit { font-size: 16px; font-weight: bold; color: #059669; }
                .arrears { font-size: 14px; font-weight: bold; color: #dc2626; }
                .separator { border-top: 1px solid #e5e7eb; margin: 15px 0; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
                .watermark { background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" font-size="8" fill="%23f3f4f6" text-anchor="middle" x="50">PAID</text></svg>') no-repeat center; background-size: 200px; }
                .fee-breakdown { background: #f9fafb; padding: 10px; border-radius: 5px; margin: 10px 0; }
                .fee-breakdown-title { font-weight: bold; margin-bottom: 8px; color: #374151; }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
      }
    }
    onPrint();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Payment Receipt</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div id="receipt-content" className="receipt watermark">
            <div className="header">
              <div className="logo">RG</div>
              <div className="school-name">Rosa Gardens School</div>
              <div className="school-address">
                Excellence in Education<br/>
                P.O. Box 123, Accra, Ghana<br/>
                Tel: +233 30 123 4567
              </div>
            </div>
            
            <Separator />
            
            <div className="receipt-title">PAYMENT RECEIPT</div>
            
            <div className="receipt-info">
              <div className="info-row">
                <span className="info-label">Receipt #:</span>
                <span>{receiptData.receiptNumber}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Date:</span>
                <span>{new Date(receiptData.date).toLocaleDateString()}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Academic Year:</span>
                <span>{receiptData.year || '2024'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Term:</span>
                <span>{receiptData.term}</span>
              </div>
            </div>

            <Separator />

            <div className="receipt-info">
              <div className="info-row">
                <span className="info-label">Student:</span>
                <span>{receiptData.studentName}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Student ID:</span>
                <span>{receiptData.studentId}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Class:</span>
                <span>{receiptData.className}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Payment Method:</span>
                <span>{receiptData.paymentMethod}</span>
              </div>
            </div>
            
            <Separator />

            {/* Fee Breakdown */}
            {(receiptData.currentTermFee || receiptData.arrears || receiptData.totalAmountDue) && (
              <div className="fee-breakdown">
                <div className="fee-breakdown-title">Fee Breakdown</div>
                {receiptData.currentTermFee && (
                  <div className="info-row">
                    <span>Current Term Fee:</span>
                    <span>GHS {receiptData.currentTermFee.toFixed(2)}</span>
                  </div>
                )}
                {receiptData.arrears && receiptData.arrears > 0 && (
                  <div className="info-row">
                    <span>Arrears from Previous Terms:</span>
                    <span className="arrears">GHS {receiptData.arrears.toFixed(2)}</span>
                  </div>
                )}
                {receiptData.totalAmountDue && (
                  <div className="info-row">
                    <span className="info-label">Total Amount Due:</span>
                    <span className="info-label">GHS {receiptData.totalAmountDue.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="info-row">
              <span className="info-label">Amount Paid:</span>
              <span className="amount">GHS {receiptData.amount.toFixed(2)}</span>
            </div>
            
            {receiptData.remainingBalance !== undefined && receiptData.remainingBalance > 0 && (
              <div className="info-row">
                <span className="info-label">Outstanding Balance:</span>
                <span className="balance">GHS {receiptData.remainingBalance.toFixed(2)}</span>
              </div>
            )}

            {receiptData.creditBalance !== undefined && receiptData.creditBalance > 0 && (
              <div className="info-row">
                <span className="info-label">Credit Balance:</span>
                <span className="credit">GHS {receiptData.creditBalance.toFixed(2)}</span>
              </div>
            )}
            
            {receiptData.notes && (
              <>
                <Separator />
                <div className="info-row">
                  <span className="info-label">Notes:</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '14px' }}>
                  {receiptData.notes}
                </div>
              </>
            )}

            <div className="footer">
              <p><strong>Thank you for your payment!</strong></p>
              <p>Keep this receipt for your records.</p>
              <p style={{ marginTop: '10px', fontSize: '10px' }}>
                This is an official receipt from Rosa Gardens School<br/>
                Academic Year: {receiptData.year || '2024'} | {receiptData.term}
              </p>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={handlePrint} className="flex items-center space-x-2">
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReceiptPrinter;
