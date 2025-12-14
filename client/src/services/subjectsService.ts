import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listSubjects() {
  return apiService.get(ENDPOINTS.subjects.list);
}

export async function getSubject(id: number) {
  return apiService.get(ENDPOINTS.subjects.get(String(id)));
}

export default { listSubjects, getSubject };
