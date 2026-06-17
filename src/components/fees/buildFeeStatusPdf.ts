import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import {
  drawClassicSchoolPdfHeader,
  formatPdfMoney,
  loadImageDataUrl,
  pdfLastTableY,
} from '../../utils/schoolPdfHeader';

export type FeeStatusPdfStudent = {
  studentNumber: string;
  studentName: string;
  className: string;
  termFee?: number;
  arrears?: number;
  totalFeeExpected: number;
  totalPaid: number;
  balance: number;
  status: 'owing' | 'paid' | 'credit' | 'not_set' | 'no_fee';
};

export type FeeStatusPdfInput = {
  schoolName: string;
  logoUrl?: string | null;
  className: string;
  periodLabel: string;
  term: string;
  academicYear: string;
  statusFilterLabel: string;
  generatedAt?: Date;
  students: FeeStatusPdfStudent[];
  summary: {
    totalTermFee?: number;
    totalArrears?: number;
    totalExpected: number;
    totalPaid: number;
    totalBalance: number;
    count: number;
  };
};

function statusLabel(status: FeeStatusPdfStudent['status']): string {
  if (status === 'owing') return 'Owing';
  if (status === 'credit') return 'Credit';
  if (status === 'not_set') return 'Not Set';
  if (status === 'no_fee') return 'No Fee Set';
  return 'Paid';
}

export async function downloadFeeStatusPdf(input: FeeStatusPdfInput): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 14;
  const generatedAt = input.generatedAt ?? new Date();
  const logoDataUrl = await loadImageDataUrl(input.logoUrl ?? null);

  const startY = drawClassicSchoolPdfHeader(doc, {
    schoolName: input.schoolName,
    logoDataUrl,
    reportTitle: 'Fee status report',
    metaLines: [
      `Class: ${input.className}`,
      `Academic period: ${input.periodLabel}`,
      `Term: ${input.term}  ·  Academic year: ${input.academicYear}`,
      `Filter: ${input.statusFilterLabel}`,
      `Generated: ${generatedAt.toLocaleDateString()} ${generatedAt.toLocaleTimeString()}`,
      `Students listed: ${input.students.length}`,
    ],
    margin,
  });

  autoTable(doc, {
    startY,
    head: [['Summary', 'Amount (GHS)']],
    body: [
      ['Total term bills', formatPdfMoney(input.summary.totalTermFee ?? 0)],
      ['Total arrears', formatPdfMoney(input.summary.totalArrears ?? 0)],
      ['Total due', formatPdfMoney(input.summary.totalExpected)],
      ['Total paid', formatPdfMoney(input.summary.totalPaid)],
      ['Outstanding balance', formatPdfMoney(Math.max(0, input.summary.totalBalance))],
      [
        'Credit balance',
        input.summary.totalBalance < -0.001
          ? formatPdfMoney(Math.abs(input.summary.totalBalance))
          : '0.00',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [242, 242, 242], textColor: 34, halign: 'left', fontStyle: 'bold' },
    bodyStyles: { valign: 'middle', textColor: 55 },
    styles: { font: 'times', fontSize: 9, cellPadding: 2.5 },
    margin: { left: margin, right: margin },
    tableLineColor: [180, 180, 180],
    tableLineWidth: 0.15,
    columnStyles: {
      0: { cellWidth: 52 },
      1: { halign: 'right', cellWidth: 42 },
    },
  });

  const tableStartY = pdfLastTableY(doc) + 8;

  autoTable(doc, {
    startY: tableStartY,
    head: [
      [
        '#',
        'Student ID',
        'Student name',
        'Total term bill',
        'Arrears',
        'Total due',
        'Paid',
        'Balance',
        'Status',
      ],
    ],
    body: input.students.map((student, index) => [
      String(index + 1),
      student.studentNumber,
      student.studentName,
      formatPdfMoney(student.termFee ?? 0),
      formatPdfMoney(student.arrears ?? 0),
      formatPdfMoney(student.totalFeeExpected ?? 0),
      formatPdfMoney(student.totalPaid),
      formatPdfMoney(student.balance),
      statusLabel(student.status),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [242, 242, 242], textColor: 34, halign: 'center', fontStyle: 'bold' },
    bodyStyles: { valign: 'middle', textColor: 55 },
    styles: { font: 'times', fontSize: 8.5, cellPadding: 2.5 },
    margin: { left: margin, right: margin },
    tableLineColor: [180, 180, 180],
    tableLineWidth: 0.15,
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 52 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 26 },
      6: { halign: 'right', cellWidth: 24 },
      7: { halign: 'right', cellWidth: 26 },
      8: { halign: 'center', cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const row = input.students[data.row.index];
      if (!row) return;

      if (data.column.index === 7) {
        if (row.balance > 0.001) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        } else if (row.balance < -0.001) {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        }
      }

      if (data.column.index === 8) {
        if (row.status === 'owing') {
          data.cell.styles.textColor = [185, 28, 28];
        } else if (row.status === 'credit') {
          data.cell.styles.textColor = [5, 150, 105];
        } else if (row.status === 'paid') {
          data.cell.styles.textColor = [22, 101, 52];
        }
      }
    },
  });

  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${input.schoolName} — Fee status report — ${input.className}`,
      margin,
      pageHeight - 8
    );
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  const safeClass = input.className.replace(/[^\w\-]+/g, '_').slice(0, 40);
  const dateStamp = generatedAt.toISOString().split('T')[0];
  doc.save(`fee-status-${safeClass}-${dateStamp}.pdf`);
}
