import * as paymentsRepo from '../repositories/payments.repository.js';

export async function recordPayment(payload: { student_id: number; amount: number; method: string; term_id?: number; meta?: any }) {
  const payment = await paymentsRepo.createPayment(payload);
  return payment;
}

export async function listPayments(filter: Record<string, any> = {}) {
  return paymentsRepo.findPayments(filter);
}

export async function getPayment(id: number) {
  return paymentsRepo.findById(id);
}

export async function getPaymentsForStudent(studentId: number) {
  return paymentsRepo.findByStudent(studentId);
}

export async function exportPaymentsCsv(filter: Record<string, any> = {}) {
  const rows = await paymentsRepo.findPayments(filter);
  if (!rows || rows.length === 0) return Buffer.from('');

  // Build CSV header from first row keys
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const lines = [header];
  for (const r of rows) {
    const vals = keys.map((k) => {
      let v: any = (r as any)[k];
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') v = JSON.stringify(v);
      // escape quotes and commas
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    });
    lines.push(vals.join(','));
  }

  const csv = lines.join('\n');
  return Buffer.from(csv, 'utf-8');
}
