import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listAuditLogs(filters?: any): Promise<{ data: any[] }> {
  return apiService.get(ENDPOINTS.audit.list);
}

export async function createAuditLog(payload: any): Promise<{ data: any }> {
  return apiService.post(ENDPOINTS.audit.list, payload);
}

export async function listLoginAudits(): Promise<{ data: any[] }> {
  return apiService.get(`${ENDPOINTS.audit.list}/logins`);
}

export async function listActivity(): Promise<{ data: any[] }> {
  return apiService.get(`${ENDPOINTS.audit.list}/activity`);
}

export default { listAuditLogs, createAuditLog, listLoginAudits, listActivity };
