import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

type AcademicPerformanceRow = {
  name?: string;
  score?: number | string;
};

type TopPerformerRow = {
  name?: string;
  class?: string;
  score?: number | string;
};

type AttendanceRow = {
  date?: string;
  rate?: number;
};

export type AcademicReportPdfInput = {
  schoolName: string;
  termLabel: string;
  academicYearLabel: string;
  totalStudents: number;
  averageAttendance: number;
  performance: {
    schoolAverage?: number;
    classPerformance?: AcademicPerformanceRow[];
    topPerformers?: TopPerformerRow[];
  };
  attendance: AttendanceRow[];
};

function formatNumber(value: number | undefined | null) {
  return Number(value ?? 0).toLocaleString('en-GH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function lastY(doc: jsPDF): number {
  const table = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return typeof table?.finalY === 'number' ? table.finalY : 40;
}

export function downloadAcademicReportPdf(data: AcademicReportPdfInput) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 14;
  let y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(data.schoolName || 'School', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Academic performance report — ${data.termLabel}`, margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Academic year: ${data.academicYearLabel}`, margin, y);
  y += 4;
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 10;

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Total students', formatNumber(data.totalStudents)],
      ['Average attendance (%)', formatNumber(data.averageAttendance)],
      ['School average score (%)', formatNumber(data.performance.schoolAverage)],
      ['Class count', String(data.performance.classPerformance?.length ?? 0)],
      ['Top performers included', String(data.performance.topPerformers?.length ?? 0)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: margin, right: margin },
  });

  y = lastY(doc) + 12;
  if (y > 240) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Class performance summary', margin, y);
  autoTable(doc, {
    startY: y + 4,
    head: [['Class', 'Average score (%)']],
    body: (data.performance.classPerformance || []).map((row) => [String(row.name ?? 'Unknown'), formatNumber(Number(row.score ?? 0))]),
    theme: 'striped',
    headStyles: { fillColor: [5, 150, 105] },
    styles: { fontSize: 8, cellPadding: 1.5 },
    margin: { left: margin, right: margin },
  });

  y = lastY(doc) + 12;
  if (y > 240) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Top performers', margin, y);
  autoTable(doc, {
    startY: y + 4,
    head: [['Rank', 'Student', 'Class', 'Score (%)']],
    body: (data.performance.topPerformers || []).slice(0, 50).map((row, index) => [String(index + 1), String(row.name ?? 'Unknown'), String(row.class ?? '—'), formatNumber(Number(row.score ?? 0))]),
    theme: 'striped',
    headStyles: { fillColor: [220, 38, 38] },
    styles: { fontSize: 8, cellPadding: 1.5 },
    margin: { left: margin, right: margin },
  });

  y = lastY(doc) + 12;
  if (y > 240) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Attendance trend', margin, y);
  autoTable(doc, {
    startY: y + 4,
    head: [['Date', 'Attendance rate (%)']],
    body: data.attendance.slice(0, 200).map((row) => [String(row.date ?? '—'), formatNumber(row.rate)]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5 },
    margin: { left: margin, right: margin },
  });

  if (data.attendance.length > 200) {
    doc.setFontSize(7);
    doc.text('(List truncated to 200 rows. Export Excel for full dataset.)', margin, lastY(doc) + 6);
  }

  const filename = `academic-report_${data.academicYearLabel.replace(/\//g, '-')}_${data.termLabel.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}
