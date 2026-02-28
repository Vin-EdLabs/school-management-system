import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listPayrollRuns(): Promise<{ data: any[] }> {
  return apiService.get(ENDPOINTS.payroll.list);
}

export async function createPayrollRun(payload: any): Promise<{ data: any }> {
  return apiService.post(ENDPOINTS.payroll.create, payload);
}

export async function getPayrollRun(id: string): Promise<{ data: any }> {
  return apiService.get(ENDPOINTS.payroll.get(id));
}

export async function initializePayroll(id: string) {
  return apiService.post(ENDPOINTS.payroll.initialize(id), {});
}

export async function recordPayment(itemId: string, payload: any) {
  return apiService.post(ENDPOINTS.payroll.recordPayment(itemId), payload);
}

export async function getStaffPaymentHistory(staffId: string) {
  return apiService.get(ENDPOINTS.payroll.staffHistory(staffId));
}

export async function addDeductions(itemId: string, payload: any) {
  return apiService.post(ENDPOINTS.payroll.addDeductions(itemId), payload);
}

export async function addBonuses(itemId: string, payload: any) {
  return apiService.post(ENDPOINTS.payroll.addBonuses(itemId), payload);
}

export async function generateReport(id: string) {
  return apiService.post(ENDPOINTS.payroll.generateReport(id), {});
}

export default {
  listPayrollRuns,
  createPayrollRun,
  getPayrollRun,
  initializePayroll,
  recordPayment,
  getStaffPaymentHistory,
  addDeductions,
  addBonuses,
  generateReport
};
