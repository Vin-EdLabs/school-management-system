import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function checkNotifications(): Promise<{ data: any }> {
  return apiService.get(ENDPOINTS.notifications);
}

export default { checkNotifications };
