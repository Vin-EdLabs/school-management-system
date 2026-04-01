import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listReports(): Promise<{ data: any[] }> {
  return apiService.get(ENDPOINTS.reports.list);
}

export async function createReport(payload: any): Promise<{ data: any }> {
  return apiService.post(ENDPOINTS.reports.create, payload);
}

export async function summary(): Promise<{ data: any }> {
  return apiService.get(`${ENDPOINTS.reports.list}/summary`);
}

export async function termReport(termId: number): Promise<{ data: any }> {
  return apiService.get(`${ENDPOINTS.reports.list}/term/${termId}`);
}

export async function yearReport(year: number): Promise<{ data: any }> {
  return apiService.get(`${ENDPOINTS.reports.list}/year/${year}`);
}

export default { listReports, createReport, summary, termReport, yearReport };
