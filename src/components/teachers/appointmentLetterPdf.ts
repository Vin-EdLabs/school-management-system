import { jsPDF } from 'jspdf';
import { formatDisplayDate } from '@/utils/dateFormat';
import type { AppointmentLetterData } from './AppointmentLetterDocument';
import { schoolInitialsFromName } from './AppointmentLetterDocument';
import { prepareLetterForPdf, resolveLetterPortalUrl } from './appointmentLetterMedia';

export type { AppointmentLetterData };

function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.includes('image/png')) return 'PNG';
  if (dataUrl.includes('image/webp')) return 'WEBP';
  return 'JPEG';
}

function addImage(doc: jsPDF, url: string | null | undefined, x: number, y: number, w: number, h: number): boolean {
  if (!url?.startsWith('data:image')) return false;
  try {
    doc.addImage(url, imageFormatFromDataUrl(url), x, y, w, h);
    return true;
  } catch {
    return false;
  }
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

  doc.setFont('Times New Roman', 'bold');
  doc.setFontSize(8);
  doc.text('TEACHER PORTAL ACCESS', margin, y);
  y += 4;

  doc.setFont('Times New Roman', 'normal');
  doc.setFontSize(8);
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, boxW);
    if (y + wrapped.length * 4 > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4;
  }

  return y + 3;
}

export function buildAppointmentLetterPdfDataUrl(data: AppointmentLetterData): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 10;

  doc.setFont('Times New Roman', 'normal');

  // Logo (left)
  const logoSize = 18;
  addImage(doc, data.school.logoUrl, margin, y, logoSize, logoSize);

  // School Name (centered)
  doc.setFont('Times New Roman', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  const schoolName = data.school.name.toUpperCase();
  const nameW = doc.getTextWidth(schoolName);
  doc.text(schoolName, pageW / 2, y + 6, { align: 'center' });

  doc.setFont('Times New Roman', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  let addrY = y + 10;
  if (data.school.address) {
    doc.text(data.school.address, pageW / 2, addrY, { align: 'center' });
    addrY += 3.5;
  }
  const contact = [data.school.phone, data.school.email].filter(Boolean).join(' · ');
  if (contact) {
    doc.text(contact, pageW / 2, addrY, { align: 'center' });
  }

  // Ref (right)
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(`Ref: ${data.referenceNumber || 'Pending'}`, pageW - margin, y + 4, { align: 'right' });

  y = 34;

  // Title box
  const titleText = 'LETTER OF APPOINTMENT';
  const titleW = doc.getTextWidth(titleText) + 20;
  const titleX = (pageW - titleW) / 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(titleX, y, titleW, 6);
  doc.setFont('Times New Roman', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(titleText, pageW / 2, y + 4.5, { align: 'center' });
  y += 10;

  // Date
  const letterDate = data.letterDate || formatDisplayDate(data.generatedDate);
  doc.setFont('Times New Roman', 'normal');
  doc.setFontSize(9);
  doc.text(`Date: ${letterDate}`, margin, y);
  y += 5.5;

  doc.text(`Dear ${data.teacher.fullName},`, margin, y);
  y += 6;

  // Body Opening
  doc.setFont('Times New Roman', 'normal');
  doc.setFontSize(9);
  const opening = doc.splitTextToSize(data.bodyOpening, pageW - margin * 2);
  doc.text(opening, margin, y);
  y += opening.length * 4.5 + 3;

  // Teacher Details Grid (2-column)
  const details = [
    ['NAME:', data.teacher.fullName],
    ['STAFF ID:', data.teacher.staffId],
    ['POSITION:', data.positionTitle],
    ['DEPARTMENT:', data.department],
    ['CLASS:', data.teacher.className],
    ['EMPLOYMENT TYPE:', data.employmentType],
  ];

  doc.setFont('Times New Roman', 'bold');
  doc.setFontSize(8);
  const col1X = margin;
  const col2X = pageW / 2 + 5;
  const labelW = 28;
  const lineH = 4.5;

  for (let i = 0; i < details.length; i++) {
    const x = i < 3 ? col1X : col2X;
    const row = i < 3 ? i : i - 3;
    const yy = y + row * lineH;

    doc.setFont('Times New Roman', 'bold');
    doc.text(details[i][0].toUpperCase(), x, yy);
    doc.setFont('Times New Roman', 'bold');
    const valX = x + labelW;
    doc.text(details[i][1].toUpperCase(), valX, yy);
    // underline
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(valX, yy + 0.5, x + 75, yy + 0.5);
  }
  y += 3 * lineH + 4;

  // Terms & Conditions Table
  doc.setFont('Times New Roman', 'bold');
  doc.setFontSize(8);
  doc.text('TERMS & CONDITIONS OF APPOINTMENT', margin, y);
  y += 3.5;

  // Table header
  const tableW = pageW - margin * 2;
  const colAW = 36;
  const colBW = tableW - colAW;
  const rowH = 4.5;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, colAW, rowH);
  doc.rect(margin + colAW, y, colBW, rowH);
  doc.setFont('Times New Roman', 'bold');
  doc.setFontSize(7);
  doc.text('TERM', margin + 1.5, y + 3);
  doc.text('DETAILS', margin + colAW + 1.5, y + 3);
  y += rowH;

  doc.setFont('Times New Roman', 'normal');
  doc.setFontSize(7);
  for (const [label, value] of termLines(data)) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.rect(margin, y, colAW, rowH);
    doc.rect(margin + colAW, y, colBW, rowH);
    doc.setFont('Times New Roman', 'bold');
    doc.text(label.toUpperCase(), margin + 1.5, y + 3);
    doc.setFont('Times New Roman', 'normal');
    doc.text(String(value), margin + colAW + 1.5, y + 3);
    y += rowH;
  }
  y += 2;

  // Custom Clauses
  doc.setFont('Times New Roman', 'normal');
  doc.setFontSize(8);
  for (const clause of data.config.customClauses || []) {
    if (!clause.trim()) continue;
    const lines = doc.splitTextToSize(clause.trim(), pageW - margin * 2);
    if (y + lines.length * 4 > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, margin, y);
    y += lines.length * 4 + 1;
  }

  // Body Closing
  const closing = doc.splitTextToSize(data.bodyClosing, pageW - margin * 2);
  doc.text(closing, margin, y);
  y += closing.length * 4 + 3;

  y = addPortalAccessSection(doc, data, margin, y);

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  // Subject List
  if (data.teacher.subjects.length > 0) {
    doc.setFont('Times New Roman', 'bold');
    doc.setFontSize(8);
    doc.text('SUBJECT(S):', margin, y);
    doc.setFont('Times New Roman', 'normal');
    doc.text(data.teacher.subjects.join(', '), margin + 22, y);
    y += 5;
  }

  // Signatures Area (Employer left, Employee right)
  const sigColW = (pageW - margin * 2 - 12) / 2;
  const sigCenterX1 = margin + sigColW / 2;
  const sigCenterX2 = margin + sigColW + 12 + sigColW / 2;

  // Employer box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin, y + 8, margin + sigColW, y + 8);
  doc.setFont('Times New Roman', 'bold');
  doc.setFontSize(7);
  doc.text('EMPLOYER', sigCenterX1, y + 7, { align: 'center' });
  y += 12;

  doc.setFont('Times New Roman', 'bold');
  doc.setFontSize(8);
  doc.text(data.config.signatoryName || '—', sigCenterX1, y, { align: 'center' });
  y += 3.5;
  doc.setFont('Times New Roman', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(data.config.signatoryTitle || '—', sigCenterX1, y, { align: 'center' });
  y += 2;

  // Signature image
  const sigImgY = y;
  if (data.config.signatureImage) {
    addImage(doc, data.config.signatureImage, sigCenterX1 - 12, sigImgY, 24, 12);
  }
  y += 14;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + sigColW, y);
  doc.setFont('Times New Roman', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text('Signature & Date', sigCenterX1, y + 4, { align: 'center' });

  // Stamp below employer signature
  if (data.config.stampImage) {
    const stampY = y + 8;
    addImage(doc, data.config.stampImage, sigCenterX1 - 10, stampY, 20, 20);
  }

  // Employee box
  const empY_start = y - 14 - 4;  // align with employer section start
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin + sigColW + 12, empY_start + 8, pageW - margin, empY_start + 8);
  doc.setFont('Times New Roman', 'bold');
  doc.setFontSize(7);
  doc.text('EMPLOYEE', sigCenterX2, empY_start + 7, { align: 'center' });

  doc.setFont('Times New Roman', 'bold');
  doc.setFontSize(8);
  doc.text(data.teacher.fullName, sigCenterX2, empY_start + 12, { align: 'center' });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin + sigColW + 12, y, pageW - margin, y);
  doc.setFont('Times New Roman', 'normal');
  doc.setFontSize(7);
  doc.text('Signature & Date', sigCenterX2, y + 4, { align: 'center' });

  // Footer
  y = y + 16;
  if (y > 285) {
    doc.addPage();
    y = 20;
  }
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  doc.setFont('Times New Roman', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  doc.text('GENERATED BY SCHOLARNERVE', pageW / 2, y + 4, { align: 'center' });

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
