import { jsPDF } from 'jspdf';
import { formatDisplayDate } from '@/utils/dateFormat';
import type { AppointmentLetterData } from './AppointmentLetterDocument';
import { schoolInitialsFromName } from './AppointmentLetterDocument';
import { prepareLetterForPdf, resolveLetterPortalUrl } from './appointmentLetterMedia';

export type { AppointmentLetterData };

const NAVY = { r: 26, g: 58, b: 92 };

function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.includes('image/png')) return 'PNG';
  if (dataUrl.includes('image/webp')) return 'WEBP';
  return 'JPEG';
}

function addLogo(doc: jsPDF, logoUrl: string | null | undefined, x: number, y: number, size: number) {
  if (!logoUrl?.startsWith('data:image')) return false;
  try {
    doc.addImage(logoUrl, imageFormatFromDataUrl(logoUrl), x, y, size, size);
    return true;
  } catch {
    return false;
  }
}

function drawInitialsBadge(doc: jsPDF, initials: string, x: number, y: number, size: number) {
  doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
  doc.rect(x, y, size, size, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(initials, x + size / 2, y + size / 2 + 2, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

function termLines(data: AppointmentLetterData): Array<[string, string]> {
  const t = data.terms;
  return [
    ['Position', t.position || data.positionTitle],
    ['Department', t.department || data.department],
    ['Start Date', formatDisplayDate(t.startDate || data.teacher.employmentDate)],
    ['Employment Type', t.employmentType || data.employmentType],
    ['Probation Period', t.probationPeriod || data.config.probationPeriod || '—'],
    ['Monthly Salary', `GHS ${Number(t.monthlySalary || data.teacher.monthlySalary).toFixed(2)}`],
    ['Working Hours', t.workingHours || data.config.workingHours || '—'],
    ['Leave Entitlement', t.leaveEntitlement || data.config.leaveEntitlement || '—'],
    ['Notice Period', t.noticePeriod || data.config.noticePeriod || '—'],
  ];
}

function addPortalAccessSection(doc: jsPDF, data: AppointmentLetterData, margin: number, startY: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  let y = startY;
  const portal = data.portalAccess;

  if (!portal?.temporaryPassword) {
    return y;
  }

  const portalUrl = resolveLetterPortalUrl(data) || '—';
  const boxW = pageW - margin * 2;
  const lines = [
    portal.instructions || 'Use the credentials below to log in to the teacher portal.',
    `Portal URL: ${portalUrl}`,
    `Username (Staff ID): ${portal.username}`,
    `Temporary Password: ${portal.temporaryPassword}`,
    portal.mustChangePassword ? 'Important: Change your password immediately after your first login.' : '',
  ].filter(Boolean);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text('TEACHER PORTAL ACCESS', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8);
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, boxW);
    if (y + wrapped.length * 4.5 > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.5 + 1;
  }

  return y + 4;
}

export function buildAppointmentLetterPdfDataUrl(data: AppointmentLetterData): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 8;

  doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
  doc.rect(0, 0, pageW, 3, 'F');
  y = 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text(data.school.name, margin, y);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 6;
  if (data.school.address) {
    doc.text(data.school.address, margin, y);
    y += 4;
  }
  const contact = [data.school.phone, data.school.email].filter(Boolean).join(' · ');
  if (contact) {
    doc.text(contact, margin, y);
  }

  const logoSize = 18;
  const logoX = pageW - margin - logoSize;
  const hasLogo = addLogo(doc, data.school.logoUrl, logoX, 10, logoSize);
  if (!hasLogo) {
    drawInitialsBadge(
      doc,
      data.school.initials || schoolInitialsFromName(data.school.name),
      logoX,
      10,
      logoSize
    );
  }
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Ref: ${data.referenceNumber || 'Pending'}`, pageW - margin, 32, { align: 'right' });

  y = 38;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Date: ${formatDisplayDate(data.letterDate || data.generatedDate)}`, margin, y);
  y += 8;
  doc.text(`Dear ${data.teacher.fullName},`, margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  const opening = doc.splitTextToSize(data.bodyOpening, pageW - margin * 2);
  doc.text(opening, margin, y);
  y += opening.length * 5 + 4;

  doc.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  const subject = `LETTER OF APPOINTMENT — ${data.positionTitle.toUpperCase()}`;
  const subjectLines = doc.splitTextToSize(subject, pageW - margin * 2 - 6);
  doc.text(subjectLines, margin + 4, y + 4);
  y += 14;

  doc.setTextColor(0, 0, 0);
  doc.setFillColor(238, 242, 247);
  const boxX = margin;
  const boxW = pageW - margin * 2;
  const boxH = 52;
  doc.rect(boxX, y, boxW, boxH, 'FD');
  doc.setDrawColor(203, 213, 225);
  doc.rect(boxX, y, boxW, boxH, 'S');

  let ty = y + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text('TERMS & CONDITIONS', boxX + 4, ty);
  ty += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8);
  for (const [label, value] of termLines(data)) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, boxX + 4, ty);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), boxX + 38, ty);
    ty += 4.5;
  }
  y += boxH + 6;

  for (const clause of data.config.customClauses || []) {
    if (!clause.trim()) continue;
    const lines = doc.splitTextToSize(clause.trim(), pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 2;
  }

  const closing = doc.splitTextToSize(data.bodyClosing, pageW - margin * 2);
  doc.text(closing, margin, y);
  y += closing.length * 5 + 6;

  y = addPortalAccessSection(doc, data, margin, y);

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  const colW = (pageW - margin * 2 - 10) / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text('Employer', margin, y);
  doc.text('Employee', margin + colW + 10, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(data.config.signatoryName || '—', margin, y);
  doc.text(data.teacher.fullName, margin + colW + 10, y);
  y += 4;
  doc.setTextColor(100, 100, 100);
  doc.text(data.config.signatoryTitle || '—', margin, y);
  y += 12;
  doc.setDrawColor(51, 65, 85);
  doc.line(margin, y, margin + colW - 5, y);
  doc.line(margin + colW + 10, y, pageW - margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('Signature          Date: ___________', margin, y);
  doc.text('Signature          Date: ___________', margin + colW + 10, y);

  return doc.output('datauristring');
}

export async function buildAppointmentLetterPdfDataUrlAsync(data: AppointmentLetterData): Promise<string> {
  const prepared = await prepareLetterForPdf(data);
  return buildAppointmentLetterPdfDataUrl(prepared);
}

export async function downloadAppointmentLetterPdf(data: AppointmentLetterData, filename: string) {
  const dataUrl = await buildAppointmentLetterPdfDataUrlAsync(data);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function pdfFromLetterContent(content: unknown): Promise<string | null> {
  if (!content || typeof content !== 'object') return null;
  try {
    return await buildAppointmentLetterPdfDataUrlAsync(content as AppointmentLetterData);
  } catch {
    return null;
  }
}
