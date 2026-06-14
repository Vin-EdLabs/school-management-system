import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

function money(n: number) {
  return Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lastY(doc: jsPDF): number {
  const t = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return typeof t?.finalY === 'number' ? t.finalY : 40;
}

export type FinancialReportPdfInput = {
  schoolName: string;
  termLabel: string;
  academicYearLabel: string;
  financeFrom: string;
  financeTo: string;
  summary: {
    totalExpected?: number;
    collected?: number;
    outstanding?: number;
    netBalance?: number;
    systemNetPosition?: number;
    otherIncome?: number;
    totalExpenses?: number;
    collectionRate?: number;
  };
  feesByClass: Array<{
    name?: string;
    students?: number;
    expected?: number | string;
    collected?: number | string;
    outstanding?: number | string;
  }>;
  outstandingFees: Array<{ name?: string; class?: string; amount?: number | string; days?: number }>;
  incomeRows: Array<Record<string, unknown>>;
  expenseRows: Array<Record<string, unknown>>;
  incomeVsExpense: Array<{ name?: string; income?: number | string; expense?: number | string }>;
  fundTransfers?: Array<{
    transfer_date?: string;
    from_account_label?: string;
    to_account_label?: string;
    amount?: number | string;
    note?: string;
    transferred_by_name?: string;
  }>;
};

export function downloadFinancialReportPdf(data: FinancialReportPdfInput) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 14;
  let y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(data.schoolName || 'School', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Financial report — ${data.termLabel}`, margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Academic year: ${data.academicYearLabel}`, margin, y);
  y += 4;
  doc.text(`Other income & expenses: all recorded entries`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 8;

  const s = data.summary;
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Amount (GHS)']],
    body: [
      ['Total fees expected (selected term)', money(Number(s.totalExpected))],
      ['Fees collected (selected term)', money(Number(s.collected))],
      ['Outstanding fees (term)', money(Number(s.outstanding))],
      ['Other income (period)', money(Number(s.otherIncome))],
      ['Total expenses (period)', money(Number(s.totalExpenses))],
      ['Net position (fees collected + other income − expenses)', money(Number(s.systemNetPosition ?? s.netBalance))],
      ['Collection rate (%)', String(Math.round(Number(s.collectionRate) || 0))],
    ],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: margin, right: margin },
  });

  y = lastY(doc) + 10;
  if (y > 250) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Fees by class', margin, y);
  y += 4;

  autoTable(doc, {
    startY: y + 2,
    head: [['Class', 'Students', 'Expected', 'Collected', 'Outstanding']],
    body: data.feesByClass.map((r) => [
      String(r.name ?? ''),
      String(r.students ?? 0),
      money(Number(r.expected)),
      money(Number(r.collected)),
      money(Number(r.outstanding)),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [5, 150, 105] },
    styles: { fontSize: 8, cellPadding: 1.5 },
    margin: { left: margin, right: margin },
  });

  y = lastY(doc) + 10;
  if (y > 230) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Top outstanding balances', margin, y);
  autoTable(doc, {
    startY: y + 4,
    head: [['Student', 'Class', 'Balance (GHS)', 'Days']],
    body:
      data.outstandingFees.length > 0
        ? data.outstandingFees.map((r) => [
            String(r.name ?? ''),
            String(r.class ?? ''),
            money(Number(r.amount)),
            String(r.days ?? '—'),
          ])
        : [['—', '—', '0.00', '—']],
    theme: 'striped',
    headStyles: { fillColor: [220, 38, 38] },
    styles: { fontSize: 8, cellPadding: 1.5 },
    margin: { left: margin, right: margin },
  });

  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Monthly fiscal flow (same period)', margin, 16);
  autoTable(doc, {
    startY: 22,
    head: [['Month', 'Income (fees + other)', 'Expenses']],
    body: data.incomeVsExpense.map((r) => [
      String(r.name ?? ''),
      money(Number(r.income)),
      money(Number(r.expense)),
    ]),
    theme: 'grid',
    styles: { fontSize: 8 },
    margin: { left: margin, right: margin },
  });

  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Income entries (detail)', margin, 16);
  const incomeBody = (data.incomeRows || []).slice(0, 200).map((row) => {
    const d = row.income_date ? String(row.income_date).split('T')[0] : '';
    return [
      d,
      String(row.category ?? row.source ?? ''),
      String(row.description ?? row.notes ?? row.source ?? '').slice(0, 60),
      money(Number(row.amount)),
    ];
  });
  autoTable(doc, {
    startY: 22,
    head: [['Date', 'Category', 'Description', 'Amount']],
    body: incomeBody.length ? incomeBody : [['—', '—', 'No records', '0.00']],
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 1 },
    margin: { left: margin, right: margin },
  });
  if ((data.incomeRows || []).length > 200) {
    doc.setFontSize(7);
    doc.text('(List truncated to 200 rows. Export Excel for full data.)', margin, lastY(doc) + 6);
  }

  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Expense entries (detail)', margin, 16);
  const expBody = (data.expenseRows || []).slice(0, 200).map((row) => {
    const d = row.payment_date ? String(row.payment_date).split('T')[0] : '';
    return [
      d,
      String(row.category ?? ''),
      String(row.title ?? row.purpose ?? '').slice(0, 50),
      String(row.payee_name ?? '').slice(0, 28),
      money(Number(row.amount)),
    ];
  });
  autoTable(doc, {
    startY: 22,
    head: [['Date', 'Category', 'Title', 'Payee', 'Amount']],
    body: expBody.length ? expBody : [['—', '—', 'No records', '', '0.00']],
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 1 },
    margin: { left: margin, right: margin },
  });
  if ((data.expenseRows || []).length > 200) {
    doc.setFontSize(7);
    doc.text('(List truncated to 200 rows. Export Excel for full data.)', margin, lastY(doc) + 6);
  }

  const transfers = data.fundTransfers || [];
  if (transfers.length > 0) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Fund transfers (between accounts)', margin, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Date', 'From', 'To', 'Amount', 'Note', 'By']],
      body: transfers.slice(0, 200).map((row) => [
        row.transfer_date ? String(row.transfer_date).split('T')[0] : '',
        String(row.from_account_label ?? ''),
        String(row.to_account_label ?? ''),
        money(Number(row.amount)),
        String(row.note ?? '').slice(0, 40),
        String(row.transferred_by_name ?? '—'),
      ]),
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 1 },
      margin: { left: margin, right: margin },
    });
  }

  const fname = `financial-report_${data.academicYearLabel.replace(/\//g, '-')}_${data.termLabel.replace(/\s+/g, '_')}.pdf`;
  doc.save(fname);
}
