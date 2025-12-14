import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import gradesService from '../services/gradesService';

export function useExamTypes() {
  return useQuery({ queryKey: ['examTypes'], queryFn: () => gradesService.listExamTypes() });
}

export function useCreateExamType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => gradesService.createExamType(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['examTypes'] })
  });
}

export function useExams(params?: any) {
  return useQuery({ queryKey: ['exams', params], queryFn: () => gradesService.listExams(params), keepPreviousData: true });
}

export function useCreateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => gradesService.createExam(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] })
  });
}

export function useLockExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, locked }: any) => gradesService.lockExam(examId, locked),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['exams', { id: vars?.examId }] })
  });
}

export function useGrades(examId?: number) {
  return useQuery({ queryKey: ['grades', examId], queryFn: () => (examId ? gradesService.getGrades(examId) : []), enabled: !!examId });
}

export function useSaveGrades() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, records }: any) => gradesService.saveGrades(examId, records),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['grades', vars?.examId] })
  });
}

export function useUpdateGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ gradeId, payload }: any) => gradesService.updateGrade(gradeId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grades'] })
  });
}

export function useDeleteGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gradeId: number) => gradesService.deleteGrade(gradeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grades'] })
  });
}

export function useExamAnalytics(examId?: number) {
  return useQuery({ queryKey: ['examAnalytics', examId], queryFn: () => (examId ? gradesService.examAnalytics(examId) : null), enabled: !!examId });
}
