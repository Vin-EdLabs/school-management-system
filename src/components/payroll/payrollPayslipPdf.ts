import { jsPDF } from 'jspdf';
import { formatMoney, MONTH_NAMES } from './payrollUtils';

export type PayslipInput = {
  schoolName: string;
  logoDataUrl?: string | null;
  staffName: string;
  staffId: string | null;
  position: string;
  month: number;
  year: number;
  currency: string;
  grossSalary: number;
  ssnitAmount: number;
  otherDeductions: number;
  allowances: number;
  netSalary: number;
  status: string;
  paidDate: string | null;
  footerText: string;
  signatureText: string;
};

export function downloadPayrollPayslipPdf(data: PayslipInput, filename: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 16;

  if (data.logoDataUrl && data.logoDataUrl.startsWith('data:image')) {
    try {
      doc.addImage(data.logoDataUrl, 'PNG', 14, y, 22, 22);
    } catch {
      try {
        doc.addImage(data.logoDataUrl, 'JPEG', 14, y, 22, 22);
      } catch {
        /* skip logo */
      }
    }
  }

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(data.schoolName, pageW / 2, y + 8, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Payslip', pageW / 2, y + 16, { align: 'center' });
  y += 32;

  const period = `${MONTH_NAMES[data.month - 1]} ${data.year}`;
  doc.setFontSize(11);
  doc.text(`Pay period: ${period}`, 14, y);
  y += 10;

  const rows: [string, string][] = [
    ['Staff name', data.staffName],
    ['Staff ID', data.staffId || '—'],
    ['Position', data.position],
    ['Gross salary', formatMoney(data.currency, data.grossSalary)],
    ['SSNIT deduction', formatMoney(data.currency, data.ssnitAmount)],
    ['Other deductions', formatMoney(data.currency, data.otherDeductions)],
    ['Allowances', formatMoney(data.currency, data.allowances)],
    ['Net salary', formatMoney(data.currency, data.netSalary)],
    ['Payment status', data.status],
    ['Payment date', data.paidDate ? new Date(data.paidDate).toLocaleDateString() : '—'],
  ];

  doc.setFontSize(10);
  rows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(k, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, 70, y);
    y += 7;
  });

  y += 8;
  doc.setDrawColor(180);
  doc.line(14, y, pageW - 14, y);
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  const footerLines = doc.splitTextToSize(data.footerText || ' ', pageW - 28);
  doc.text(footerLines, 14, y);
  y += footerLines.length * 5 + 6;

  doc.setFont('helvetica', 'normal');
  doc.text(data.signatureText || 'Authorized signatory', 14, y);
  y += 6;
  doc.line(14, y, 80, y);

  doc.save(filename);
}

export function printPayslipHtml(data: PayslipInput): void {
  const period = `${MONTH_NAMES[data.month - 1]} ${data.year}`;
  const logo =
    data.logoDataUrl && data.logoDataUrl.startsWith('data:image')
      ? `<img src="${data.logoDataUrl}" alt="" style="max-height:56px;margin-bottom:8px" />`
      : '';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Payslip</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 16px; color: #111; }
    .wrap { max-width: 520px; margin: 0 auto; }
    h1 { font-size: 1.25rem; margin: 0 0 4px; text-align: center; }
    .sub { text-align: center; color: #555; font-size: 0.9rem; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
    th, td { text-align: left; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    th { width: 42%; color: #374151; font-weight: 600; }
    .footer { margin-top: 24px; font-size: 0.85rem; color: #4b5563; }
    .sig { margin-top: 28px; font-size: 0.9rem; }
    .line { border-bottom: 1px solid #111; width: 200px; margin-top: 32px; }
    @media print { body { padding: 12px; } }
  </style></head><body><div class="wrap">
    <div style="text-align:center">${logo}<h1>${escapeHtml(data.schoolName)}</h1><div class="sub">Payslip · ${escapeHtml(period)}</div></div>
    <table>
      <tr><th>Staff name</th><td>${escapeHtml(data.staffName)}</td></tr>
      <tr><th>Staff ID</th><td>${escapeHtml(data.staffId || '—')}</td></tr>
      <tr><th>Position</th><td>${escapeHtml(data.position)}</td></tr>
      <tr><th>Gross salary</th><td>${escapeHtml(formatMoney(data.currency, data.grossSalary))}</td></tr>
      <tr><th>SSNIT deduction</th><td>${escapeHtml(formatMoney(data.currency, data.ssnitAmount))}</td></tr>
      <tr><th>Other deductions</th><td>${escapeHtml(formatMoney(data.currency, data.otherDeductions))}</td></tr>
      <tr><th>Allowances</th><td>${escapeHtml(formatMoney(data.currency, data.allowances))}</td></tr>
      <tr><th>Net salary</th><td><strong>${escapeHtml(formatMoney(data.currency, data.netSalary))}</strong></td></tr>
      <tr><th>Payment status</th><td>${escapeHtml(data.status)}</td></tr>
      <tr><th>Payment date</th><td>${escapeHtml(data.paidDate ? new Date(data.paidDate).toLocaleDateString() : '—')}</td></tr>
    </table>
    <div class="footer">${escapeHtml(data.footerText)}</div>
    <div class="sig">${escapeHtml(data.signatureText || 'Authorized signatory')}<div class="line"></div></div>
  </div></body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      /* popup blocked or print failed */
    }
  }, 300);
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
