import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import {
  drawClassicSchoolPdfHeader,
  formatPdfMoney,
  loadImageDataUrl,
  pdfLastTableY,
} from '../../utils/schoolPdfHeader';

const NO_BUS_LABEL = 'No bus assigned';

export type TransportOwingRow = {
  studentNumber: string;
  studentName: string;
  className: string;
  routeName: string;
  stopName: string;
  amountOwed: number;
  busName?: string;
  busPlate?: string;
  driverName?: string;
};

export type TransportFeesOwingPdfInput = {
  schoolName: string;
  logoUrl?: string | null;
  filterLabel: string;
  generatedAt?: Date;
  /** Every rider included in the report's scope (owing or not) — used for the summary counts. */
  totalRiders: number;
  /** Riders who owe fees, already sorted for display. */
  owing: TransportOwingRow[];
};

export async function downloadTransportFeesOwingPdf(input: TransportFeesOwingPdfInput): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 14;
  const generatedAt = input.generatedAt ?? new Date();
  const logoDataUrl = await loadImageDataUrl(input.logoUrl ?? null);
  const totalOwed = input.owing.reduce((sum, r) => sum + r.amountOwed, 0);

  const startY = drawClassicSchoolPdfHeader(doc, {
    schoolName: input.schoolName,
    logoDataUrl,
    reportTitle: 'School fees owing — students on the school bus',
    metaLines: [
      `Scope: ${input.filterLabel}`,
      `Generated: ${generatedAt.toLocaleDateString()} ${generatedAt.toLocaleTimeString()}`,
    ],
    margin,
  });

  autoTable(doc, {
    startY,
    head: [['Summary', 'Value']],
    body: [
      ['Students on school transport', String(input.totalRiders)],
      ['Riders owing fees', String(input.owing.length)],
      ['Total amount owed (GHS)', formatPdfMoney(totalOwed)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [242, 242, 242], textColor: 34, halign: 'left', fontStyle: 'bold' },
    bodyStyles: { valign: 'middle', textColor: 55 },
    styles: { font: 'times', fontSize: 9, cellPadding: 2.5 },
    margin: { left: margin, right: margin },
    tableLineColor: [180, 180, 180],
    tableLineWidth: 0.15,
    columnStyles: {
      0: { cellWidth: 62 },
      1: { halign: 'right', cellWidth: 42 },
    },
  });

  autoTable(doc, {
    startY: pdfLastTableY(doc) + 8,
    head: [['#', 'Student ID', 'Student name', 'Class', 'Bus', 'Route', 'Pickup location', 'Amount owed (GHS)']],
    body: input.owing.map((r, i) => [
      String(i + 1),
      r.studentNumber || '—',
      r.studentName,
      r.className || '—',
      [r.busName, r.busPlate].filter(Boolean).join(' ') || NO_BUS_LABEL,
      r.routeName || '—',
      r.stopName || '—',
      formatPdfMoney(r.amountOwed),
    ]),
    foot: [['', '', '', '', '', '', 'Total', formatPdfMoney(totalOwed)]],
    showFoot: 'lastPage',
    theme: 'grid',
    headStyles: { fillColor: [242, 242, 242], textColor: 34, halign: 'center', fontStyle: 'bold' },
    footStyles: { fillColor: [242, 242, 242], textColor: 34, fontStyle: 'bold', halign: 'right' },
    bodyStyles: { valign: 'middle', textColor: 55 },
    styles: { font: 'times', fontSize: 8.5, cellPadding: 2.5 },
    margin: { left: margin, right: margin },
    tableLineColor: [180, 180, 180],
    tableLineWidth: 0.15,
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 48 },
      3: { cellWidth: 24 },
      4: { cellWidth: 40 },
      5: { cellWidth: 36 },
      6: { cellWidth: 40 },
      7: { halign: 'right', cellWidth: 45 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = 'bold';
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
    doc.text(`${input.schoolName} — School fees owing (bus riders)`, margin, pageHeight - 8);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  doc.save(`school-fees-owing-bus-riders-${generatedAt.toISOString().split('T')[0]}.pdf`);
}
type BusGroup = { label: string; driver: string; rows: TransportOwingRow[] };

function groupOwingByBus(owing: TransportOwingRow[]): BusGroup[] {
  const groups = new Map<string, BusGroup>();
  for (const r of owing) {
    const name = (r.busName || '').trim();
    const plate = (r.busPlate || '').trim();
    const hasBus = Boolean(name || plate);
    const key = hasBus ? `${name}|${plate}` : NO_BUS_LABEL;
    const label = hasBus ? (name && plate ? `${name} (${plate})` : name || plate) : NO_BUS_LABEL;
    if (!groups.has(key)) groups.set(key, { label, driver: r.driverName || '', rows: [] });
    groups.get(key)!.rows.push(r);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.label === NO_BUS_LABEL) return 1;
    if (b.label === NO_BUS_LABEL) return -1;
    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'bus';

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function downloadBusPdf(
  input: TransportFeesOwingPdfInput,
  group: BusGroup,
  logoDataUrl: string | null,
  generatedAt: Date
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 14;
  const busTotal = group.rows.reduce((sum, r) => sum + r.amountOwed, 0);

  const startY = drawClassicSchoolPdfHeader(doc, {
    schoolName: input.schoolName,
    logoDataUrl,
    reportTitle: `School fees owing — ${group.label}`,
    metaLines: [
      `Scope: ${input.filterLabel}`,
      `Generated: ${generatedAt.toLocaleDateString()} ${generatedAt.toLocaleTimeString()}`,
    ],
    margin,
  });

  autoTable(doc, {
    startY,
    head: [['Summary', 'Value']],
    body: [
      ['Bus', group.label],
      ['Driver', group.driver || '—'],
      ['Riders owing fees', String(group.rows.length)],
      ['Total amount owed (GHS)', formatPdfMoney(busTotal)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [242, 242, 242], textColor: 34, halign: 'left', fontStyle: 'bold' },
    bodyStyles: { valign: 'middle', textColor: 55 },
    styles: { font: 'times', fontSize: 9, cellPadding: 2.5 },
    margin: { left: margin, right: margin },
    tableLineColor: [180, 180, 180],
    tableLineWidth: 0.15,
    columnStyles: {
      0: { cellWidth: 62 },
      1: { halign: 'right', cellWidth: 80 },
    },
  });

  autoTable(doc, {
    startY: pdfLastTableY(doc) + 8,
    head: [['#', 'Student ID', 'Student name', 'Class', 'Pickup location', 'Amount owed (GHS)']],
    body: group.rows.map((r, i) => [
      String(i + 1),
      r.studentNumber || '—',
      r.studentName,
      r.className || '—',
      [r.routeName, r.stopName].filter(Boolean).join(' · ') || '—',
      formatPdfMoney(r.amountOwed),
    ]),
    foot: [['', '', '', '', 'Total', formatPdfMoney(busTotal)]],
    showFoot: 'lastPage',
    theme: 'grid',
    headStyles: { fillColor: [242, 242, 242], textColor: 34, halign: 'center', fontStyle: 'bold' },
    footStyles: { fillColor: [242, 242, 242], textColor: 34, fontStyle: 'bold', halign: 'right' },
    bodyStyles: { valign: 'middle', textColor: 55 },
    styles: { font: 'times', fontSize: 8.5, cellPadding: 2.5 },
    margin: { left: margin, right: margin },
    tableLineColor: [180, 180, 180],
    tableLineWidth: 0.15,
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 30 },
      2: { cellWidth: 62 },
      3: { cellWidth: 32 },
      4: { cellWidth: 88 },
      5: { halign: 'right', cellWidth: 47 },
    },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = 'bold';
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
    doc.text(`${input.schoolName} — ${group.label} — fees owing`, margin, pageHeight - 8);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  doc.save(`school-fees-owing-${slugify(group.label)}-${generatedAt.toISOString().split('T')[0]}.pdf`);
}

/**
 * One separate PDF per bus (Bus A, Bus B, …), each listing only that bus's owing riders
 * with their pickup locations. Returns the bus labels that were downloaded.
 */
export async function downloadTransportFeesOwingByBusPdf(input: TransportFeesOwingPdfInput): Promise<string[]> {
  const generatedAt = input.generatedAt ?? new Date();
  const logoDataUrl = await loadImageDataUrl(input.logoUrl ?? null);
  const groups = groupOwingByBus(input.owing);
  for (let i = 0; i < groups.length; i += 1) {
    // Small gap so the browser treats these as separate downloads instead of dropping them
    if (i > 0) await wait(500);
    await downloadBusPdf(input, groups[i], logoDataUrl, generatedAt);
  }
  return groups.map(g => g.label);
}
