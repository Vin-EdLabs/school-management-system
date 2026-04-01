import type { CreatePaymentPayload, Payment } from '../types/payment';
import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listPayments(): Promise<{ data: Payment[] }> {
  return apiService.get(ENDPOINTS.payments.list);
}

export async function createPayment(payload: CreatePaymentPayload): Promise<{ data: Payment }> {
  return apiService.post(ENDPOINTS.payments.create, payload);
}

export async function getPayment(id: number): Promise<{ data: Payment }> {
  return apiService.get(ENDPOINTS.payments.get(id.toString()));
}

export async function paymentsByStudent(studentId: number) {
  return apiService.get(`${ENDPOINTS.payments.list}/student/${studentId}`);
}

export async function paymentsByTerm(termId: number) {
  return apiService.get(`${ENDPOINTS.payments.list}/term/${termId}`);
}

export async function exportPayments() {
  return apiService.get(`${ENDPOINTS.payments.list}/export`);
}

export default { listPayments, createPayment, getPayment, paymentsByStudent, paymentsByTerm, exportPayments };
