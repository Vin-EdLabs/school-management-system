import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { drawClassicSchoolPdfHeader, formatPdfMoney, loadImageDataUrl } from './schoolPdfHeader';

const MARGIN = 14;

function drawPageFooters(doc: jsPDF, schoolName: string, reportTitle: string) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${schoolName} — ${reportTitle}`, MARGIN, pageHeight - 8);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });
  }
}

export interface TeacherRosterRow {
  fullName: string;
  staffId: string;
  classes: string;
  department: string;
  salary: number;
  phone: string;
  email: string;
}

export interface OtherStaffRosterRow {
  fullName: string;
  staffId: string;
  position: string;
  department: string;
  salary: number;
  phone: string;
  email: string;
}

export async function downloadTeacherRosterPdf(input: {
  schoolName: string;
  logoUrl: string | null;
  teachers: TeacherRosterRow[];
}): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoDataUrl = await loadImageDataUrl(input.logoUrl);
  const generatedAt = new Date();
  const reportTitle = 'Teacher Roster';

  const startY = drawClassicSchoolPdfHeader(doc, {
    schoolName: input.schoolName,
    logoDataUrl,
    reportTitle,
    metaLines: [
      `Generated: ${generatedAt.toLocaleString()}`,
      `Total teachers: ${input.teachers.length}`,
    ],
    margin: MARGIN,
  });

  autoTable(doc, {
    startY,
    head: [['#', 'Teacher Name', 'Staff ID', 'Class(es)', 'Department', 'Salary', 'Contact']],
    body: input.teachers.map((row, index) => [
      String(index + 1),
      row.fullName,
      row.staffId,
      row.classes || '—',
      row.department || '—',
      row.salary > 0 ? formatPdfMoney(row.salary) : '—',
      [row.phone, row.email].filter(Boolean).join('\n') || '—',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [242, 242, 242], textColor: 34, halign: 'center' },
    bodyStyles: { valign: 'middle', fontSize: 8 },
    styles: { cellPadding: 2.5, textColor: 55 },
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: {
      0: { cellWidth: 8 },
      2: { cellWidth: 22 },
      5: { halign: 'right' },
    },
  });

  drawPageFooters(doc, input.schoolName, reportTitle);
  doc.save(`teacher-roster-${generatedAt.toISOString().split('T')[0]}.pdf`);
}

export async function downloadOtherStaffRosterPdf(input: {
  schoolName: string;
  logoUrl: string | null;
  staff: OtherStaffRosterRow[];
}): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoDataUrl = await loadImageDataUrl(input.logoUrl);
  const generatedAt = new Date();
  const reportTitle = 'Staff Roster';

  const startY = drawClassicSchoolPdfHeader(doc, {
    schoolName: input.schoolName,
    logoDataUrl,
    reportTitle,
    metaLines: [
      `Generated: ${generatedAt.toLocaleString()}`,
      `Total staff: ${input.staff.length}`,
    ],
    margin: MARGIN,
  });

  autoTable(doc, {
    startY,
    head: [['#', 'Staff Name', 'Staff ID', 'Position', 'Department', 'Salary', 'Contact']],
    body: input.staff.map((row, index) => [
      String(index + 1),
      row.fullName,
      row.staffId,
      row.position || '—',
      row.department || '—',
      row.salary > 0 ? formatPdfMoney(row.salary) : '—',
      [row.phone, row.email].filter(Boolean).join('\n') || '—',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [242, 242, 242], textColor: 34, halign: 'center' },
    bodyStyles: { valign: 'middle', fontSize: 8 },
    styles: { cellPadding: 2.5, textColor: 55 },
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: {
      0: { cellWidth: 8 },
      2: { cellWidth: 22 },
      5: { halign: 'right' },
    },
  });

  drawPageFooters(doc, input.schoolName, reportTitle);
  doc.save(`staff-roster-${generatedAt.toISOString().split('T')[0]}.pdf`);
}
