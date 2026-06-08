import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useOptionalSchool } from '../../contexts/SchoolContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Download, Printer } from 'lucide-react';
import { apiService } from '../../services/api';
import { resolveLogoUrl } from '../../services/tenantService';
import { formatDisplayDate } from '../../utils/dateFormat';

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
  schoolNameOverride?: string;
  logoUrlOverride?: string | null;
}

const ReceiptPrinter: React.FC<ReceiptPrinterProps> = ({
  receiptData,
  onPrint,
  show,
  onClose,
  schoolNameOverride,
  logoUrlOverride,
}) => {
  const schoolCtx = useOptionalSchool();
  const school = schoolCtx?.school ?? null;
  const [receiptSettings, setReceiptSettings] = useState<{
    postal_address?: string;
    contact_phone?: string;
    receipt_footer?: string;
    bank_details?: string;
  } | null>(null);
  const schoolName = schoolNameOverride || school?.name || 'School';
  const logoUrl = resolveLogoUrl(logoUrlOverride ?? school?.logo_url ?? null);

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

  const isFullPayment = (receiptData.remainingBalance || 0) <= 0;
  const statusLabel = isFullPayment ? "FULL PAYMENT" : "PARTIAL PAYMENT";
  const currentTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const buildReceiptHtml = () => `
      <html>
        <head>
          <title>Receipt - ${receiptData.receiptNumber}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: Arial, Helvetica, sans-serif;
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
            .status-badge { display: inline-block; padding: 4pt 8pt; border: 1pt solid #000; font-size: 9pt; font-weight: bold; margin-top: 5pt; }
            .section { margin-bottom: 10pt; font-size: 9pt; }
            .section-title { font-size: 8pt; font-weight: bold; text-transform: uppercase; border-bottom: 0.5pt solid #ccc; margin-bottom: 4pt; padding-bottom: 2pt; }
            .row { display: flex; justify-content: space-between; margin-bottom: 3pt; line-height: 1.1; }
            .label { font-weight: normal; }
            .value { font-weight: bold; text-align: right; }
            .amount-box { border: 1pt solid #000; padding: 8pt; text-align: center; margin: 10pt 0; }
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
              <h2>Official Receipt</h2>
              <p>#${receiptData.receiptNumber}</p>
              <div class="date">Date: ${formatDisplayDate(receiptData.date)} | ${currentTime}</div>
              <div class="status-badge">${statusLabel}</div>
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
                ${receiptData.currentTermFee !== undefined ? `<tr><td>Current Fee</td><td style="text-align:right">${receiptData.currentTermFee.toFixed(2)}</td></tr>` : ''}
                ${receiptData.arrears !== undefined && receiptData.arrears > 0 ? `<tr><td>Old Arrears</td><td style="text-align:right">${receiptData.arrears.toFixed(2)}</td></tr>` : ''}
              </table>
              <div class="row total-line">
                <span>Total Due:</span>
                <span>GHS ${(receiptData.totalAmountDue || (Number(receiptData.currentTermFee || 0) + Number(receiptData.arrears || 0)) || (receiptData.amount || 0)).toFixed(2)}</span>
              </div>
              <div class="row" style="margin-top:5px; font-weight:700;">
                <span>Balance:</span>
                <span style="color:#000">GHS ${(receiptData.remainingBalance || 0).toFixed(2)}</span>
              </div>
              <div class="row" style="margin-top:2px;">
                <span>Status:</span>
                <span style="color:${(receiptData.remainingBalance || 0) <= 0 ? '#16a34a' : '#ea580c'}; font-weight:700;">
                  ${(receiptData.remainingBalance || 0) <= 0 ? 'FULL PAYMENT' : 'PARTIAL PAYMENT'}
                </span>
              </div>
            </div>
            ${receiptData.notes ? `<div class="notes">Note: ${receiptData.notes}</div>` : ''}
            <div class="footer">
              <p class="thanks">${receiptSettings?.receipt_footer || 'THANK YOU!'}</p>
              ${receiptSettings?.contact_phone ? `<p style="font-weight:bold; margin-top:5pt;">School Contact: ${receiptSettings.contact_phone}</p>` : ''}
              <p>Generated via Scholarnerve | ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-content');
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(buildReceiptHtml());
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

  const handleDownload = () => {
    const html = buildReceiptHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${receiptData.receiptNumber}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <Card className="modal max-w-md w-full shadow-2xl border-0 rounded-2xl">
        <CardHeader className="bg-white border-b sticky top-0 z-10 py-4 px-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">Print Preview</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100 transition-colors">×</Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 bg-slate-100/50">
          <div
            id="receipt-content"
            className="bg-white p-6 shadow-sm mx-auto border border-slate-200 text-black"
            style={{ width: '80mm', minHeight: '120mm' }}
          >
            {/* Minimalist Web Preview */}
            <div className="text-center mb-6 border-b border-dashed border-slate-300 pb-6">
              {logoUrl ? (
                <img src={logoUrl} className="w-20 h-20 mx-auto mb-3 object-contain rounded-lg" alt="Logo" />
              ) : (
                <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-slate-200">
                  {schoolName.slice(0, 1)}
                </div>
              )}
              <h2 className="text-lg font-black uppercase leading-tight tracking-tight text-slate-900">{schoolName}</h2>
              <p className="text-[10px] text-slate-700 mt-2 font-medium tracking-wide uppercase">{receiptSettings?.postal_address}</p>
              <p className="text-[10px] text-slate-600 font-bold">{receiptSettings?.contact_phone && `Tel: ${receiptSettings.contact_phone}`}</p>
            </div>

            <div className="text-center mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-800">Official Receipt</p>
              <p className="text-lg font-black leading-none mt-1 text-slate-950">#{receiptData.receiptNumber}</p>
              <p className="text-[8px] text-slate-600 mt-1 uppercase font-bold">Date: {formatDisplayDate(receiptData.date)} | {currentTime}</p>
              <div className="inline-block mt-3 px-3 py-1 border border-slate-900 rounded text-[9px] font-black text-slate-900 uppercase">
                {statusLabel}
              </div>
            </div>

            <div className="space-y-1 mb-4 text-[10px] border-b border-slate-200 pb-4">
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">Student:</span>
                <span className="font-black text-slate-950">{receiptData.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">Student ID:</span>
                <span className="font-black text-slate-950">{receiptData.studentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">Class:</span>
                <span className="font-black text-slate-950">{receiptData.className}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">Term:</span>
                <span className="font-black text-slate-950">{receiptData.term}</span>
              </div>
            </div>

            <div className="bg-slate-100 border border-slate-900 p-3 text-center mb-4">
              <p className="text-[8px] font-bold uppercase text-slate-700 tracking-tighter">Amount Paid</p>
              <p className="text-xl font-black text-slate-950">GHS {(receiptData.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>

            <div className="space-y-1 text-[10px] mb-4">
              <div className="flex justify-between border-b border-slate-200 pb-1 mb-1 font-black text-slate-800 text-[8px] uppercase">
                <span>Breakdown</span>
                <span>Amount</span>
              </div>
              {receiptData.currentTermFee !== undefined && (
                <div className="flex justify-between text-slate-700">
                  <span className="font-medium">Current Fee:</span>
                  <span className="font-bold">{receiptData.currentTermFee.toFixed(2)}</span>
                </div>
              )}
              {receiptData.arrears !== undefined && receiptData.arrears > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span className="font-medium">Old Arrears:</span>
                  <span className="font-bold">{receiptData.arrears.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-300 font-black text-sm text-slate-950">
                <span>Total Due:</span>
                <span>{(receiptData.totalAmountDue || (receiptData.amount || 0)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 text-slate-800">
                <span>Balance:</span>
                <span>{(receiptData.remainingBalance || 0).toFixed(2)}</span>
              </div>
            </div>

            {receiptData.notes && (
              <div className="text-[8px] font-medium italic text-slate-700 border-t border-dashed border-slate-300 pt-2 mb-4">
                Note: {receiptData.notes}
              </div>
            )}

            <div className="text-center pt-4 border-t border-dashed border-slate-300">
              <p className="text-[9px] font-black uppercase text-slate-900">{receiptSettings?.receipt_footer || 'Thank You!'}</p>
              {receiptSettings?.contact_phone && (
                <p className="text-[8px] font-black text-slate-700 mt-1 uppercase">Contact: {receiptSettings.contact_phone}</p>
              )}
              <p className="text-[7px] text-slate-500 mt-2 italic font-bold">Generated via Scholarnerve | {new Date().toLocaleString()}</p>
            </div>
          </div>

          <div className="flex flex-col space-y-2 mt-6">
            <Button
              onClick={handleDownload}
              variant="outline"
              className="w-full py-6 rounded-xl font-bold flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Receipt</span>
            </Button>
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
