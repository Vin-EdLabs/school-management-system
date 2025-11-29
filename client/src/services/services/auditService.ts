import { apiService } from '../api';
import ENDPOINTS from '../endpoints';

export async function listLoginAudits() {
  return apiService.get(`${ENDPOINTS.audit}/logins`);
}

export async function listActivity() {
  return apiService.get(`${ENDPOINTS.audit}/activity`);
}

export async function exportAudit() {
  return apiService.get(`${ENDPOINTS.audit}/export`);
}

export default { listLoginAudits, listActivity, exportAudit };
