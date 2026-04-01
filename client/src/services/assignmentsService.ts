import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listAssignments(): Promise<{ data: any[] }> {
  return apiService.get(ENDPOINTS.assignments.list);
}

export async function createAssignment(payload: { teacher_id: number; class_id: number }) {
  return apiService.post(ENDPOINTS.assignments.create, payload);
}

export async function removeAssignment(payload: { teacher_id: number; class_id: number }) {
  // backend expects DELETE with JSON body; apiService.delete doesn't send body, so call fetch directly
  const base = (import.meta.env.VITE_API_BASE as string) ?? '/api';
  const res = await fetch(`${base}${ENDPOINTS.assignments.remove}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let body: any = text;
    try { body = JSON.parse(text); } catch (e) { /* ignore */ }
    const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }
  return res.json();
}

export async function listByTeacher(id: string | number) {
  return apiService.get(ENDPOINTS.assignments.byTeacher(id.toString()));
}

export async function listByClass(id: string | number) {
  return apiService.get(ENDPOINTS.assignments.byClass(id.toString()));
}

export default { listAssignments, createAssignment, removeAssignment, listByTeacher, listByClass };
