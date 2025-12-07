import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listPermissions(): Promise<{ data: any[] }> {
  return apiService.get(ENDPOINTS.permissions);
}

export default { listPermissions };
