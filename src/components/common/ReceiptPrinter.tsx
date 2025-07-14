
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
  receiptNumber: string;
  notes?: string;
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
              <title>Payment Receipt</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .receipt { max-width: 400px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 20px; }
                .school-name { font-size: 24px; font-weight: bold; color: #1f2937; }
                .school-address { font-size: 14px; color: #6b7280; margin-top: 5px; }
                .receipt-title { font-size: 18px; font-weight: bold; margin: 20px 0; text-align: center; }
                .receipt-info { margin: 10px 0; }
                .info-row { display: flex; justify-content: space-between; margin: 8px 0; }
                .info-label { font-weight: bold; }
                .amount { font-size: 20px; font-weight: bold; color: #059669; }
                .separator { border-top: 1px solid #e5e7eb; margin: 15px 0; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
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
      <Card className="max-w-md w-full mx-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Payment Receipt</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div id="receipt-content" className="receipt">
            <div className="header">
              <div className="school-name">Rosa Gardens School</div>
              <div className="school-address">
                Excellence in Education<br/>
                Accra, Ghana
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
                <span className="info-label">Term:</span>
                <span>{receiptData.term}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Payment Method:</span>
                <span>{receiptData.paymentMethod}</span>
              </div>
              
              <Separator />
              
              <div className="info-row">
                <span className="info-label">Amount Paid:</span>
                <span className="amount">GHS {receiptData.amount.toFixed(2)}</span>
              </div>
              
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
            </div>
            
            <div className="footer">
              <p>Thank you for your payment!</p>
              <p>Keep this receipt for your records.</p>
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
