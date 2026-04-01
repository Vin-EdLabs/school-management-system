import { useQuery } from '@tanstack/react-query';
import * as reportsService from '../services/reportsService';

export function useReportsSummary() {
  return useQuery<any, Error, any>({ queryKey: ['reports','summary'], queryFn: () => reportsService.summary() });
}

export function useReportTerm(termId: number) {
  return useQuery<any, Error, any>({ queryKey: ['reports','term', termId], queryFn: () => reportsService.termReport(termId) });
}

export function useReportYear(year: number) {
  return useQuery<any, Error, any>({ queryKey: ['reports','year', year], queryFn: () => reportsService.yearReport(year) });
}
