import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { query } from '../config/db.js';

export async function getSummary() {
  // fees collected (payments), income, expenses
  const feesRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM payments');
  const incomeRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM income');
  const expensesRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM expenses');
  return {
    feesCollected: Number(feesRes.rows[0].total || 0),
    otherIncome: Number(incomeRes.rows[0].total || 0),
    expenses: Number(expensesRes.rows[0].total || 0),
    net: Number((feesRes.rows[0].total || 0) + (incomeRes.rows[0].total || 0) - (expensesRes.rows[0].total || 0)),
  };
}

export async function getTermAggregates(termId: number) {
  const feesRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE term_id = $1', [termId]);
  return { feesCollected: Number(feesRes.rows[0].total || 0) };
}

export async function getYearAggregates(year: number) {
  const incomeRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM income WHERE year = $1', [year]);
  const expensesRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE year = $1', [year]);
  const feesRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE EXTRACT(YEAR FROM created_at) = $1', [year]);
  return {
    fees: Number(feesRes.rows[0].total || 0),
    income: Number(incomeRes.rows[0].total || 0),
    expenses: Number(expensesRes.rows[0].total || 0),
  };
}

export async function getTrends() {
  // monthly totals for payments as simple example
  const res = await query(
    `SELECT to_char(created_at, 'YYYY-MM') as month, COALESCE(SUM(amount),0) as total FROM payments GROUP BY month ORDER BY month DESC LIMIT 12`
  );
  return res.rows;
}

export async function generatePdf(payload: any = {}) {
  // Build a simple PDF report based on payload or summary
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: any[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const end = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Header
  doc.fontSize(18).text('School Management Report', { align: 'center' });
  doc.moveDown();

  // If payload contains explicit report data, prefer it, otherwise compute summary
  let data: any = payload;
  if (!payload || Object.keys(payload).length === 0) {
    data = await getSummary();
  }

  // Write key metrics
  doc.fontSize(12);
  for (const [k, v] of Object.entries(data)) {
    doc.text(`${String(k)}: ${String((v as any) ?? '')}`);
    doc.moveDown(0.2);
  }

  doc.moveDown();
  doc.text('Generated at: ' + new Date().toISOString());
  doc.end();
  return end;
}

export async function generateExcel(payload: any = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');

  let data: any = payload;
  if (!payload || Object.keys(payload).length === 0) {
    data = await getSummary();
  }

  // Flatten data: each key-value pair as a row
  sheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 30 },
  ];

  for (const [k, v] of Object.entries(data)) {
    sheet.addRow({ metric: k, value: (v as any) ?? '' });
  }

  // Add generation timestamp
  sheet.addRow({ metric: 'Generated At', value: new Date().toISOString() });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
