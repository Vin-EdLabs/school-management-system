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
