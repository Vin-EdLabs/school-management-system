import type { CreatePaymentPayload, Payment } from '../../types/payment';
import { apiService } from '../api';
import ENDPOINTS from '../endpoints';

export async function listPayments(): Promise<{ data: Payment[] }> {
  return apiService.get(ENDPOINTS.payments);
}

export async function createPayment(payload: CreatePaymentPayload): Promise<{ data: Payment }> {
  return apiService.post(ENDPOINTS.payments, payload);
}

export async function getPayment(id: number): Promise<{ data: Payment }> {
  return apiService.get(`${ENDPOINTS.payments}/${id}`);
}

export async function paymentsByStudent(studentId: number) {
  return apiService.get(`${ENDPOINTS.payments}/student/${studentId}`);
}

export async function paymentsByTerm(termId: number) {
  return apiService.get(`${ENDPOINTS.payments}/term/${termId}`);
}

export async function exportPayments() {
  return apiService.get(`${ENDPOINTS.payments}/export`);
}

export default { listPayments, createPayment, getPayment, paymentsByStudent, paymentsByTerm, exportPayments };
