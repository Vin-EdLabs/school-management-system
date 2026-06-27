import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import {
  drawClassicSchoolPdfHeader,
  loadImageDataUrl,
  pdfLastTableY,
} from '@/utils/schoolPdfHeader';
import { resolveLogoUrl } from '@/services/tenantService';
import { formatDisplayDate } from '@/utils/dateFormat';
import type { StudentDailyFeeReport } from '@/services/dailyFeeReportsApi';
import { formatGhs } from '@/services/dailyFeeReportsApi';

const MARGIN = 14;

const TABLE_THEME = {
  theme: 'grid' as const,
  headStyles: {
    fillColor: [242, 242, 242] as [number, number, number],
    textColor: 34,
    halign: 'left' as const,
    fontStyle: 'bold' as const,
  },
  bodyStyles: { valign: 'top' as const, textColor: 55 },
  styles: {
    font: 'times',
    fontSize: 9,
    cellPadding: 3,
    lineColor: [180, 180, 180] as [number, number, number],
    lineWidth: 0.15,
  },
  margin: { left: MARGIN, right: MARGIN },
  tableLineColor: [180, 180, 180] as [number, number, number],
  tableLineWidth: 0.15,
};

function profileFilename(name: string): string {
  const safe = name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `DailyFee_Report_${safe || 'Student'}_${ymd}.pdf`;
}

export async function downloadDailyFeeStudentReportPdf(
  report: StudentDailyFeeReport,
  schoolName: string,
  logoUrl?: string | null
): Promise<void> {
  const resolved = resolveLogoUrl(logoUrl ?? null);
  const logoDataUrl = resolved ? await loadImageDataUrl(resolved) : null;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const generatedAt = new Date();

  let y = drawClassicSchoolPdfHeader(doc, {
    schoolName,
    logoDataUrl,
    reportTitle: 'Daily Fee Collection Report',
    metaLines: [
      `Student: ${report.student.fullName}`,
      `ID: ${report.student.studentId} · Class: ${report.student.className}`,
      `Term: ${report.term.label}`,
      `Generated: ${generatedAt.toLocaleDateString()} ${generatedAt.toLocaleTimeString()}`,
    ],
    margin: MARGIN,
  });

  autoTable(doc, {
    startY: y,
    head: [[{ content: 'Summary', colSpan: 2 }]],
    body: [
      ['Total Paid This Term', formatGhs(report.summary.totalPaid)],
      ['Number of Payments', String(report.summary.paymentCount)],
      ['Days Covered', String(report.summary.daysCovered)],
      ['Average Payment', formatGhs(report.summary.averagePayment)],
      ['Next Due Date', report.summary.nextDueDate ? formatDisplayDate(report.summary.nextDueDate) : 'Up to date'],
      ['Current Status', `${report.summary.currentStatus} — ${report.summary.statusDetail}`],
    ],
    ...TABLE_THEME,
    columnStyles: {
      0: { cellWidth: 58, fontStyle: 'bold' as const },
      1: { cellWidth: 'auto' as const },
    },
  });

  y = pdfLastTableY(doc) + 6;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Date', 'Type', 'Amount', 'Covers From', 'Covers To', 'School Days', 'Method']],
    body: [
      ...report.payments.map((p, i) => [
        String(i + 1),
        formatDisplayDate(p.date),
        p.typeLabel,
        formatGhs(p.amount),
        formatDisplayDate(p.coversFrom),
        formatDisplayDate(p.coversTo),
        String(p.schoolDays),
        p.method,
      ]),
      [
        'Total',
        '',
        '',
        formatGhs(report.accountSummary.totalAmountPaid),
        '',
        '',
        String(report.payments.reduce((s, p) => s + p.schoolDays, 0)),
        '',
      ],
    ],
    ...TABLE_THEME,
  });

  y = pdfLastTableY(doc) + 6;
  const rates = report.accountSummary.rates;

  autoTable(doc, {
    startY: y,
    head: [[{ content: 'Account Summary', colSpan: 2 }]],
    body: [
      ['Term', report.accountSummary.termLabel],
      ['Total School Days in Term', String(report.accountSummary.totalSchoolDays)],
      ['Days Covered by Payments', String(report.accountSummary.daysCovered)],
      ['Days Not Covered', String(report.accountSummary.daysNotCovered)],
      ['Total Amount Paid', formatGhs(report.accountSummary.totalAmountPaid)],
      [
        'Rates',
        `Daily ${formatGhs(rates.daily)} · Weekly ${formatGhs(rates.weekly)} · Monthly ${formatGhs(rates.monthly)} · Termly ${formatGhs(rates.termly)}`,
      ],
      ['Current Coverage Status', report.accountSummary.coverageStatusLabel],
    ],
    ...TABLE_THEME,
    columnStyles: {
      0: { cellWidth: 58, fontStyle: 'bold' as const },
      1: { cellWidth: 'auto' as const },
    },
  });

  const paid = report.coverageCalendar.filter((d) => d.status === 'paid').length;
  const unpaid = report.coverageCalendar.filter((d) => d.status === 'unpaid').length;
  const closed = report.coverageCalendar.filter((d) => d.status === 'closed').length;
  const future = report.coverageCalendar.filter((d) => d.status === 'future').length;

  y = pdfLastTableY(doc) + 6;
  autoTable(doc, {
    startY: y,
    head: [[{ content: 'Coverage Map Summary', colSpan: 2 }]],
    body: [
      ['Paid / covered days', String(paid)],
      ['Past unpaid days', String(unpaid)],
      ['School closure / weekend', String(closed)],
      ['Future school days', String(future)],
    ],
    ...TABLE_THEME,
    columnStyles: {
      0: { cellWidth: 58, fontStyle: 'bold' as const },
      1: { cellWidth: 'auto' as const },
    },
  });

  doc.save(profileFilename(report.student.fullName));
}

export function exportDailyFeePaymentsCsv(report: StudentDailyFeeReport): void {
  const headers = ['#', 'Date', 'Type', 'Amount', 'Covers From', 'Covers To', 'School Days', 'Method', 'Receipt'];
  const rows = report.payments.map((p, i) => [
    String(i + 1),
    p.date,
    p.typeLabel,
    String(p.amount),
    p.coversFrom,
    p.coversTo,
    String(p.schoolDays),
    p.method,
    p.receiptNumber || '',
  ]);
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daily-fee-payments-${report.student.studentId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
