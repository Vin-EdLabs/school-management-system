import { useQuery } from '@tanstack/react-query';
import * as reportsService from '../services/services/reportsService';

export function useReportsSummary() {
  return useQuery(['reports','summary'], () => reportsService.summary());
}

export function useReportTerm(termId: number) {
  return useQuery(['reports','term', termId], () => reportsService.termReport(termId));
}

export function useReportYear(year: number) {
  return useQuery(['reports','year', year], () => reportsService.yearReport(year));
}
