import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import {
  drawClassicSchoolPdfHeader,
  loadImageDataUrl,
} from '../../utils/schoolPdfHeader';
import type { TermReport } from './termReportTypes';

export type ClassTablePdfInput = {
  schoolName: string;
  logoUrl?: string | null;
  termReport: TermReport;
};

function positionLabel(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

export async function downloadClassTablePdf(input: ClassTablePdfInput): Promise<void> {
  const { termReport } = input;
  const csWeight = termReport.classScoreWeight ?? 50;
  const exWeight = termReport.examWeight ?? 50;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;
  const generatedAt = new Date();
  const logoDataUrl = await loadImageDataUrl(input.logoUrl ?? null);
  const grandMax = termReport.students[0]?.grandMax;

  const startY = drawClassicSchoolPdfHeader(doc, {
    schoolName: input.schoolName,
    logoDataUrl,
    reportTitle: 'Class term report table',
    metaLines: [
      `Class: ${termReport.className}`,
      termReport.currentTerm && termReport.currentYear
        ? `Term: ${termReport.currentTerm} · ${termReport.currentYear}`
        : '',
      `${termReport.subjects.length} subjects · ${termReport.students.length} students`,
      `Class score ${csWeight}% · Exam ${exWeight}%`,
      `Generated: ${generatedAt.toLocaleDateString()} ${generatedAt.toLocaleTimeString()}`,
    ].filter(Boolean),
    margin,
  });

  const headRow = [
    'Student',
    ...termReport.subjects.map((subj) => `${subj}\nCS ${csWeight}% · EX ${exWeight}%`),
    grandMax != null ? `Total\n/${grandMax}` : 'Total',
    '%',
    'Pos',
  ];

  const body = termReport.students.map((student) => {
    const nameCell = `${student.firstName} ${student.lastName}${
      student.hasMoved ? ' (moved)' : ''
    }\n${student.admissionNumber}`;

    const subjectCells = termReport.subjects.map((subj) => {
      const ss = student.subjectScores[subj];
      if (!ss) return '—';
      const score = ss.score != null ? Number(ss.score).toFixed(1) : '—';
      const cs = ss.classScore != null ? Number(ss.classScore).toFixed(1) : '—';
      const ex = ss.examScore != null ? Number(ss.examScore).toFixed(1) : '—';
      const grade = ss.gradeLabel || (ss.grade != null ? String(ss.grade) : '');
      return grade ? `${score}\nCS:${cs} EX:${ex}\n${grade}` : `${score}\nCS:${cs} EX:${ex}`;
    });

    return [
      nameCell,
      ...subjectCells,
      String(student.grandTotal),
      `${student.percentage}%`,
      positionLabel(student.position),
    ];
  });

  const posColumnIndex = headRow.length - 1;

  autoTable(doc, {
    startY,
    head: [headRow],
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      halign: 'center',
      fontStyle: 'bold',
      fontSize: 6.5,
      valign: 'middle',
    },
    bodyStyles: { valign: 'middle', textColor: 55, fontSize: 6.5 },
    styles: { font: 'helvetica', cellPadding: 1.6, overflow: 'linebreak' },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 34, halign: 'left' },
      [posColumnIndex]: { halign: 'center', cellWidth: 12 },
      [posColumnIndex - 1]: { halign: 'center', cellWidth: 12 },
      [posColumnIndex - 2]: { halign: 'center', cellWidth: 14 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const student = termReport.students[data.row.index];
      if (!student) return;

      if (data.column.index === posColumnIndex) {
        if (student.position === 1) {
          data.cell.styles.fillColor = [254, 249, 195];
          data.cell.styles.fontStyle = 'bold';
        } else if (student.position === 2) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
        } else if (student.position === 3) {
          data.cell.styles.fillColor = [255, 247, 237];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${input.schoolName} — Class table — ${termReport.className}`,
      margin,
      pageHeight - 6
    );
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  const safeClass = termReport.className.replace(/[^\w\-]+/g, '_').slice(0, 40);
  const dateStamp = generatedAt.toISOString().split('T')[0];
  doc.save(`class-table-${safeClass}-${dateStamp}.pdf`);
}
