import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export type PerformanceRow = {
  subject: string;
  classScore?: number | null;
  examScore?: number | null;
  total: number;
  max: number;
  percentage: number;
  grade?: string;
  remark?: string;
};

export type TermReportPdfInput = {
  tenantId?: number;
  schoolName: string;
  schoolLogoUrl?: string | null;
  schoolMotto?: string | null;
  schoolContact?: string | null;
  className: string;
  currentTerm: string;
  currentYear: string;
  studentName: string;
  admissionNumber: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  position?: number | null;
  totalStudents?: number | null;
  grandTotal: number;
  grandMax: number;
  percentage: number;
  performanceRows: PerformanceRow[];
  attendance?: { present: number; absent: number; totalDays: number } | null;
  gradeScale: Array<{ letter: string; minPct: number; maxPct: number; description?: string }>;
  teacherRemark?: string | null;
  headmasterRemark?: string | null;
  headmasterName?: string | null;
  headmasterTitle?: string | null;
  studentPhotoUrl?: string | null;
};

const NAVY = '#0b2745';
const GOLD = '#b68b1f';
const LIGHT_NAVY = '#e9eef6';
const LIGHT_GRAY = '#f6f7f9';

function gradeColor(letter?: string) {
  if (!letter) return '#111827';
  if (letter === 'A') return '#16a34a';
  if (letter === 'B') return '#2563eb';
  if (letter === 'C') return '#f97316';
  return '#dc2626';
}

export function downloadTermReportCardPdf(input: TermReportPdfInput) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - margin * 2;
  let y = margin;

  // Header band
  doc.setFillColor(NAVY);
  doc.rect(0, 0, pageWidth, 44, 'F');

  // Left: logo
  const logoSize = 28;
  const logoX = margin;
  const logoY = 8;
  if (input.schoolLogoUrl) {
    try {
      (doc as any).addImage(input.schoolLogoUrl, 'JPEG', logoX, logoY, logoSize, logoSize);
    } catch (e) {
      doc.setFillColor(GOLD);
      doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 'F');
    }
  } else {
    doc.setFillColor(GOLD);
    doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 'F');
    doc.setTextColor('#ffffff');
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    const initials = input.schoolName.split(' ').map(s => s[0] || '').slice(0, 2).join('').toUpperCase();
    doc.text(initials, logoX + logoSize / 2, logoY + logoSize / 2 + 4, { align: 'center' });
  }

  // Right: student photo
  const photoSize = 30;
  const photoX = margin + usableWidth - photoSize;
  const photoY = 7;
  doc.setDrawColor('#ffffff');
  doc.setLineWidth(0.8);
  doc.rect(photoX, photoY, photoSize, photoSize);
  if (input.studentPhotoUrl) {
    try { (doc as any).addImage(input.studentPhotoUrl, 'JPEG', photoX, photoY, photoSize, photoSize); } catch (e) { /* ignore */ }
  } else {
    doc.setFontSize(10);
    doc.setTextColor('#ffffff');
    doc.text('Photo', photoX + photoSize / 2, photoY + photoSize / 2 + 3, { align: 'center' });
  }

  // Center: school info
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor('#ffffff');
  doc.text(input.schoolName || '', pageWidth / 2, 18, { align: 'center' });

  if (input.schoolMotto) {
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.text(input.schoolMotto, pageWidth / 2, 25, { align: 'center' });
  }

  if (input.schoolContact) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(input.schoolContact, pageWidth / 2, 31, { align: 'center' });
  }

  // Gold divider
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.9);
  doc.line(margin, 44.5, pageWidth - margin, 44.5);

  y = 50;

  // Title bar
  doc.setFillColor(LIGHT_NAVY);
  doc.rect(margin, y - 6, usableWidth, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(NAVY);
  doc.text('STUDENT ACADEMIC REPORT', pageWidth / 2, y + 2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${input.currentTerm} | ${input.currentYear}`, pageWidth / 2, y + 8, { align: 'center' });

  y += 18;

  // Student info card
  const infoCardHeight = 36;
  doc.setFillColor('#ffffff');
  doc.setDrawColor('#e3e6ea');
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, usableWidth, infoCardHeight, 2, 2, 'S');
  const colGap = 8;
  const colW = (usableWidth - colGap) / 2;
  const leftX = margin + 6;
  const rightX = margin + 6 + colW + colGap;
  let infoY = y + 8;
  const labelColor = '#6b7280';
  const valueColor = '#111827';

  function drawLabelValue(x: number, ly: number, label: string, value?: string) {
    doc.setTextColor(labelColor);
    doc.setFontSize(8);
    doc.text(label, x, ly);
    doc.setTextColor(valueColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(value || '—', x, ly + 5);
    doc.setFont('helvetica', 'normal');
  }

  drawLabelValue(leftX, infoY, 'Student Name', input.studentName);
  drawLabelValue(rightX, infoY, 'Class', input.className);
  infoY += 9;
  drawLabelValue(leftX, infoY, 'Admission No', input.admissionNumber);
  drawLabelValue(rightX, infoY, 'Term', input.currentTerm);
  infoY += 9;
  drawLabelValue(leftX, infoY, 'Date of Birth', input.dateOfBirth || '');
  drawLabelValue(rightX, infoY, 'Academic Year', input.currentYear);
  infoY += 9;
  drawLabelValue(leftX, infoY, 'Gender', input.gender || '');
  const posText = input.position && input.totalStudents ? `${input.position} of ${input.totalStudents}` : (input.position ? String(input.position) : '');
  drawLabelValue(rightX, infoY, 'Position', posText || '');

  y += infoCardHeight + 8;

  // Performance table
  const tableStartY = y;
  const tableHead = [['Subject', 'Class Score', 'Exam Score', 'Total', 'Max', '%', 'Grade', 'Remark']];
  const tableBody = input.performanceRows.map(r => [
    String(r.subject || ''),
    r.classScore == null ? '' : String(r.classScore),
    r.examScore == null ? '' : String(r.examScore),
    String(r.total),
    String(r.max),
    `${Math.round(r.percentage)}%`,
    r.grade || '',
    r.remark || '',
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: tableHead,
    body: tableBody,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [11, 39, 69], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 248] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
    didDrawPage: (page) => { y = (doc as any).lastAutoTable?.finalY || y; }
  });

  // Totals
  const totals = input.performanceRows.reduce((acc, r) => { acc.total += r.total; acc.max += r.max; return acc; }, { total: 0, max: 0 });
  const classAvg = input.performanceRows.length ? (totals.total / input.performanceRows.length) : 0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`TOTAL: ${totals.total} / ${totals.max}`, margin, y + 8);
  doc.setFont('helvetica', 'italic');
  doc.text(`CLASS AVERAGE: ${Math.round(classAvg)}`, margin + 60, y + 8);

  y += 18;

  // Summary boxes
  const boxW = (usableWidth - 9) / 4;
  const boxH = 26;
  const labels = ['Total Score', 'Percentage', 'Grade', 'Position'];
  const values = [
    String(input.grandTotal),
    `${Math.round(input.percentage)}%`,
    (() => {
      const g = input.gradeScale.find(s => input.percentage >= s.minPct && input.percentage <= s.maxPct);
      return g ? g.letter : '';
    })(),
    input.position ? `${input.position}/${input.totalStudents || '-'}` : ''
  ];

  for (let i = 0; i < 4; i++) {
    const bx = margin + i * (boxW + 3);
    doc.setDrawColor('#e6e9ee');
    doc.roundedRect(bx, y, boxW, boxH, 2, 2, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#6b7280');
    doc.text(labels[i], bx + 6, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const valColor = i === 2 ? gradeColor(values[2]) : '#111827';
    doc.setTextColor(valColor);
    doc.text(values[i], bx + 6, y + 18);
  }

  y += boxH + 10;

  // Attendance
  if (input.attendance) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor('#111827');
    doc.text(
      `Days Present: ${input.attendance.present}   |   Days Absent: ${input.attendance.absent}   |   Total School Days: ${input.attendance.totalDays}`,
      margin,
      y
    );
    y += 10;
  }

  // Grading scale
  const scaleX = margin + usableWidth - 70;
  let scaleY = y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Grading Scale', scaleX, scaleY);
  scaleY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const s of input.gradeScale) {
    doc.setTextColor('#111827');
    doc.text(`${s.letter}: ${s.minPct}% - ${s.maxPct}%`, scaleX, scaleY);
    scaleY += 4.8;
  }

  // Remarks boxes
  const remarkH = 32;
  const remarkW = (usableWidth - 8) / 2;
  const leftRemarkX = margin;
  const rightRemarkX = margin + remarkW + 8;
  if (y + remarkH + 40 > doc.internal.pageSize.getHeight() - margin) {
    doc.addPage();
    y = margin;
  }
  doc.roundedRect(leftRemarkX, y, remarkW, remarkH, 2, 2, 'S');
  doc.roundedRect(rightRemarkX, y, remarkW, remarkH, 2, 2, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text("Class Teacher's Remarks", leftRemarkX + 4, y + 6);
  doc.text("Headmaster's Remarks", rightRemarkX + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const teacherLines = input.teacherRemark ? doc.splitTextToSize(input.teacherRemark, remarkW - 8) : [''];
  const headLines = input.headmasterRemark ? doc.splitTextToSize(input.headmasterRemark, remarkW - 8) : [''];
  doc.text(teacherLines, leftRemarkX + 4, y + 12);
  doc.text(headLines, rightRemarkX + 4, y + 12);

  // Signature lines
  const sigY = y + remarkH - 6;
  doc.setLineWidth(0.4);
  doc.line(leftRemarkX + 10, sigY, leftRemarkX + 60, sigY);
  doc.text('Name', leftRemarkX + 10, sigY + 4);
  doc.line(rightRemarkX + 10, sigY, rightRemarkX + 60, sigY);
  const hmSigLabel = [input.headmasterName, input.headmasterTitle].filter(Boolean).join(' — ') || 'Name';
  doc.text(hmSigLabel, rightRemarkX + 10, sigY + 4);

  y += remarkH + 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Next Term Begins: ______________________', pageWidth / 2, y, { align: 'center' });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - margin + 6;
  doc.setDrawColor('#e6e9ee');
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
  doc.setFontSize(8);
  doc.setTextColor('#6b7280');
  doc.text(`${input.schoolName} · Powered by ScholarNerve`, margin, footerY - 2);
  doc.text('This report is computer generated and is valid without a stamp', pageWidth - margin - 10, footerY - 2, { align: 'right' });
  doc.text(`Page 1`, pageWidth / 2, footerY - 2, { align: 'center' });

  const filename = `${(input.studentName || 'student').replace(/\s+/g, '_')}_${(input.admissionNumber || '').replace(/\s+/g, '_')}_Term_${input.currentTerm.replace(/\s+/g, '_')}_${input.currentYear}.pdf`;
  doc.save(filename);
}
