import { apiService } from '../api';
import ENDPOINTS from '../endpoints';

export async function summary() {
  return apiService.get(`${ENDPOINTS.reports}/summary`);
}

export async function termReport(termId: number) {
  return apiService.get(`${ENDPOINTS.reports}/term/${termId}`);
}

export async function yearReport(year: number) {
  return apiService.get(`${ENDPOINTS.reports}/year/${year}`);
}

export async function trends() {
  return apiService.get(`${ENDPOINTS.reports}/trends`);
}

export async function pieChart() {
  return apiService.get(`${ENDPOINTS.reports}/pie-chart`);
}

export async function exportCsv() {
  return apiService.get(`${ENDPOINTS.reports}/export/csv`);
}

export async function exportPdf() {
  return apiService.get(`${ENDPOINTS.reports}/export/pdf`);
}

export async function exportExcel() {
  return apiService.get(`${ENDPOINTS.reports}/export/excel`);
}

export default { summary, termReport, yearReport, trends, pieChart, exportCsv, exportPdf, exportExcel };
