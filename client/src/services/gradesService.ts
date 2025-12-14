import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listExamTypes() {
  const res = await apiService.get(ENDPOINTS.grades.types);
  return (res as any)?.data || [];
}

export async function createExamType(payload: any) {
  const res = await apiService.post(ENDPOINTS.grades.types, payload);
  return (res as any)?.data;
}

export async function listExams(params?: any) {
  // apiService doesn't support query params helper; build simple query string when params provided
  let url = ENDPOINTS.grades.base;
  if (params) {
    const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
    if (qs) url += `?${qs}`;
  }
  const res = await apiService.get(url);
  return (res as any)?.data || [];
}

export async function createExam(payload: any) {
  const res = await apiService.post(ENDPOINTS.grades.base, payload);
  return (res as any)?.data;
}

export async function lockExam(examId: number, locked: boolean) {
  const res = await apiService.put(`${ENDPOINTS.grades.base}/${examId}/lock`, { locked });
  return (res as any)?.data;
}

export async function getGrades(examId: number) {
  const res = await apiService.get(`${ENDPOINTS.grades.base}/${examId}/grades`);
  return (res as any)?.data || [];
}

export async function saveGrades(examId: number, records: any[]) {
  const res = await apiService.post(`${ENDPOINTS.grades.base}/${examId}/grades`, { records });
  return (res as any)?.data || [];
}

export async function updateGrade(gradeId: number, payload: any) {
  const res = await apiService.put(`${ENDPOINTS.grades.base}/grade/${gradeId}`, payload);
  return (res as any)?.data;
}

export async function deleteGrade(gradeId: number) {
  const res = await apiService.delete(`${ENDPOINTS.grades.base}/grade/${gradeId}`);
  return (res as any)?.data;
}

export async function examAnalytics(examId: number) {
  const res = await apiService.get(`${ENDPOINTS.grades.base}/${examId}/analytics`);
  return (res as any)?.data;
}

export async function listBoundaries(params?: any) {
  let url = `${ENDPOINTS.grades.base}/boundaries`;
  if (params) {
    const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
    if (qs) url += `?${qs}`;
  }
  const res = await apiService.get(url);
  return (res as any)?.data || [];
}

export async function createBoundary(payload: any) {
  const res = await apiService.post(`${ENDPOINTS.grades.base}/boundaries`, payload);
  return (res as any)?.data;
}

export async function updateBoundary(id: number, payload: any) {
  const res = await apiService.put(`${ENDPOINTS.grades.base}/boundaries/${id}`, payload);
  return (res as any)?.data;
}

export async function deleteBoundary(id: number) {
  const res = await apiService.delete(`${ENDPOINTS.grades.base}/boundaries/${id}`);
  return (res as any)?.data;
}

export default {
  listExamTypes,
  createExamType,
  listExams,
  createExam,
  lockExam,
  getGrades,
  saveGrades,
  updateGrade,
  deleteGrade,
  examAnalytics,
  listBoundaries,
  createBoundary,
  updateBoundary,
  deleteBoundary
};
