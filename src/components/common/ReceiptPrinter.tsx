import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useSchool } from '../../contexts/SchoolContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Printer } from 'lucide-react';
import { apiService } from '../../services/api';
import { resolveLogoUrl } from '../../services/tenantService';

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
  const { school } = useSchool();
  const [receiptSettings, setReceiptSettings] = useState<{
    postal_address?: string;
    contact_phone?: string;
    receipt_footer?: string;
    bank_details?: string;
  } | null>(null);
  const schoolName = school?.name ?? 'School';
  const logoUrl = resolveLogoUrl(school?.logo_url ?? null);

  useEffect(() => {
    if (show) {
      apiService.get<Record<string, unknown>>('/settings').then((s) => {
        setReceiptSettings({
          postal_address: s?.postal_address as string | undefined,
          contact_phone: s?.contact_phone as string | undefined,
          receipt_footer: s?.receipt_footer as string | undefined,
          bank_details: s?.bank_details as string | undefined,
        });
      }).catch(() => setReceiptSettings(null));
    }
  }, [show]);

  if (!show) return null;

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-content');
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Receipt - ${receiptData.receiptNumber}</title>
              <style>
                @page { 
                  size: 80mm auto; 
                  margin: 0; 
                }
                body { 
                  font-family: Arial, Helvetica, sans-serif; /* Best for low-res thermal print */
                  margin: 0; 
                  padding: 5mm; 
                  background: white; 
                  color: #000;
                  width: 80mm; 
                  -webkit-print-color-adjust: exact;
                }
                .receipt-container { width: 70mm; margin: 0 auto; }
                
                .header { text-align: center; margin-bottom: 10pt; border-bottom: 1pt dashed #000; padding-bottom: 8pt; }
                .school-logo { width: 50pt; height: 50pt; object-fit: contain; margin-bottom: 5pt; filter: grayscale(100%); }
                .school-name { margin: 0; font-size: 14pt; font-weight: bold; text-transform: uppercase; line-height: 1.1; letter-spacing: -0.5pt; }
                .school-info p { margin: 1pt 0; font-size: 8pt; color: #000; }
                
                .receipt-meta { text-align: center; margin: 8pt 0; }
                .receipt-meta h2 { margin: 0; font-size: 10pt; font-weight: bold; text-transform: uppercase; }
                .receipt-meta p { margin: 2pt 0; font-size: 14pt; font-weight: bold; }
                .date { font-size: 8pt; color: #000; }
                
                .section { margin-bottom: 10pt; font-size: 9pt; }
                .section-title { font-size: 8pt; font-weight: bold; text-transform: uppercase; border-bottom: 0.5pt solid #ccc; margin-bottom: 4pt; padding-bottom: 2pt; }
                .row { display: flex; justify-content: space-between; margin-bottom: 3pt; line-height: 1.1; }
                .label { font-weight: normal; }
                .value { font-weight: bold; text-align: right; }

                .amount-box { 
                  border: 1pt solid #000; 
                  padding: 8pt; 
                  text-align: center; 
                  margin: 10pt 0;
                }
                .amount-label { font-size: 8pt; font-weight: bold; text-transform: uppercase; }
                .amount-total { font-size: 18pt; font-weight: bold; margin-top: 2pt; }
                
                .charges-table { width: 100%; border-collapse: collapse; margin-top: 4pt; font-size: 8pt; }
                .charges-table td { padding: 3pt 0; border-bottom: 0.5pt solid #eee; }
                .total-line { font-weight: bold; border-top: 1pt solid #000; margin-top: 4pt; padding-top: 4pt; font-size: 10pt; }

                .notes { margin-top: 8pt; font-size: 8pt; font-style: italic; border-top: 0.5pt dashed #ccc; padding-top: 4pt; }
                
                .footer { text-align: center; margin-top: 12pt; border-top: 1pt dashed #000; padding-top: 8pt; font-size: 8pt; }
                .footer p { margin: 2pt 0; }
                .thanks { font-weight: bold; font-size: 9pt; margin-bottom: 4pt; }
              </style>
            </head>
            <body>
              <div class="receipt-container">
                <div class="header">
                  ${logoUrl ? `<img src="${logoUrl}" class="school-logo" />` : ''}
                  <h1 class="school-name">${schoolName}</h1>
                  <div class="school-info">
                    <p>${receiptSettings?.postal_address || ''}</p>
                    <p>${receiptSettings?.contact_phone ? `Tel: ${receiptSettings.contact_phone}` : ''}</p>
                  </div>
                </div>

                <div class="receipt-meta">
                  <h2>Payment Receipt</h2>
                  <p>#${receiptData.receiptNumber}</p>
                  <div class="date">Date: ${new Date(receiptData.date).toLocaleDateString('en-GB')}</div>
                </div>

                <div class="section">
                  <div class="section-title">Student & Academic</div>
                  <div class="row"><span class="label">Name:</span><span class="value">${receiptData.studentName}</span></div>
                  <div class="row"><span class="label">ID:</span><span class="value">${receiptData.studentId}</span></div>
                  <div class="row"><span class="label">Class:</span><span class="value">${receiptData.className}</span></div>
                  <div class="row"><span class="label">Term:</span><span class="value">${receiptData.term}</span></div>
                  <div class="row"><span class="label">Method:</span><span class="value">${receiptData.paymentMethod}</span></div>
                </div>

                <div class="amount-box">
                  <div class="amount-label">Amount Paid</div>
                  <div class="amount-total">GHS ${(receiptData.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>

                <div class="section">
                  <div class="section-title">Breakdown</div>
                  <table class="charges-table">
                    ${receiptData.currentTermFee !== undefined ? `
                      <tr><td>Current Fee</td><td style="text-align:right">${receiptData.currentTermFee.toFixed(2)}</td></tr>
                    ` : ''}
                    ${receiptData.arrears !== undefined && receiptData.arrears > 0 ? `
                      <tr><td>Old Arrears</td><td style="text-align:right">${receiptData.arrears.toFixed(2)}</td></tr>
                    ` : ''}
                  </table>
                  <div class="row total-line">
                    <span>Total Due:</span>
                    <span>GHS ${(receiptData.totalAmountDue || (receiptData.amount || 0)).toFixed(2)}</span>
                  </div>
                  <div class="row" style="margin-top:5px; font-weight:700;">
                    <span>Balance:</span>
                    <span style="color:#000">GHS ${(receiptData.remainingBalance || 0).toFixed(2)}</span>
                  </div>
                </div>

                ${receiptData.notes ? `<div class="notes">Note: ${receiptData.notes}</div>` : ''}

                <div class="footer">
                  <p class="thanks">${receiptSettings?.receipt_footer || 'THANK YOU!'}</p>
                  <p>Computer Generated Receipt</p>
                  <p>Date: ${new Date().toLocaleString()}</p>
                </div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
    onPrint();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border-0 rounded-2xl">
        <CardHeader className="bg-white border-b sticky top-0 z-10 py-4 px-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Print Preview</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100 transition-colors">×</Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 bg-slate-100/50">
          <div 
            id="receipt-content" 
            className="bg-white p-6 shadow-sm mx-auto border border-slate-200"
            style={{ width: '80mm', minHeight: '120mm' }}
          >
            {/* Minimalist Web Preview */}
            <div className="text-center mb-6 border-b border-dashed pb-6">
              {logoUrl ? (
                <img src={logoUrl} className="w-20 h-20 mx-auto mb-3 object-contain rounded-lg shadow-sm" alt="Logo" />
              ) : (
                <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-slate-200">
                  {schoolName.slice(0, 1)}
                </div>
              )}
              <h2 className="text-lg font-black uppercase leading-tight tracking-tight text-slate-900">{schoolName}</h2>
              <p className="text-[10px] text-slate-500 mt-2 font-medium tracking-wide uppercase">{receiptSettings?.postal_address}</p>
              <p className="text-[10px] text-slate-400 font-bold">{receiptSettings?.contact_phone && `Tel: ${receiptSettings.contact_phone}`}</p>
            </div>

            <div className="text-center mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Payment Receipt</p>
              <p className="text-lg font-black leading-none mt-1">#{receiptData.receiptNumber}</p>
              <p className="text-[8px] text-slate-400 mt-1 uppercase font-bold">Date: {new Date(receiptData.date).toLocaleDateString('en-GB')}</p>
            </div>

            <div className="space-y-1 mb-4 text-[10px] border-b pb-4">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Student:</span>
                <span className="font-bold">{receiptData.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Class:</span>
                <span className="font-bold">{receiptData.className}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Term:</span>
                <span className="font-bold">{receiptData.term}</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-900 p-3 text-center mb-4">
              <p className="text-[8px] font-bold uppercase text-slate-500 tracking-tighter">Amount Paid</p>
              <p className="text-xl font-black">GHS {(receiptData.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>

            <div className="space-y-1 text-[10px] mb-4">
               <div className="flex justify-between border-b border-slate-100 pb-1 mb-1 font-bold text-slate-400 text-[8px] uppercase">
                 <span>Breakdown</span>
                 <span>Amount</span>
               </div>
               {receiptData.currentTermFee !== undefined && (
                 <div className="flex justify-between">
                   <span>Current Fee:</span>
                   <span>{receiptData.currentTermFee.toFixed(2)}</span>
                 </div>
               )}
               {receiptData.arrears !== undefined && receiptData.arrears > 0 && (
                 <div className="flex justify-between">
                   <span>Old Arrears:</span>
                   <span>{receiptData.arrears.toFixed(2)}</span>
                 </div>
               )}
               <div className="flex justify-between pt-2 border-t font-black text-sm">
                 <span>Total Due:</span>
                 <span>{(receiptData.totalAmountDue || (receiptData.amount || 0)).toFixed(2)}</span>
               </div>
               <div className="flex justify-between font-bold pt-1">
                 <span>Balance:</span>
                 <span>{(receiptData.remainingBalance || 0).toFixed(2)}</span>
               </div>
            </div>

            {receiptData.notes && (
              <div className="text-[8px] italic text-slate-500 border-t border-dashed pt-2 mb-4">
                 Note: {receiptData.notes}
              </div>
            )}

            <div className="text-center pt-4 border-t border-dashed">
               <p className="text-[9px] font-black uppercase">{receiptSettings?.receipt_footer || 'Thank You!'}</p>
               <p className="text-[7px] text-slate-400 mt-1 italic">Generated via Technerve SMS</p>
            </div>
          </div>

          <div className="flex flex-col space-y-2 mt-6">
            <Button 
              onClick={handlePrint} 
              className="w-full py-6 rounded-xl bg-slate-900 hover:bg-black text-white font-bold flex items-center justify-center space-x-2 shadow-lg shadow-slate-200 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Slip</span>
            </Button>
            <Button variant="ghost" onClick={onClose} className="w-full text-slate-400 font-medium">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReceiptPrinter;
