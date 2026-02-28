import { toast } from '@/hooks/use-toast';
import * as studentsService from '@/services/studentsService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStudentPayload } from '../types/student';

/**
 * Hook for managing the list of students.
 * Provides caching and automatic invalidation.
 */
export function useStudents() {
  const queryClient = useQueryClient();

  const { data: studentsResp, isLoading, error } = useQuery<any, Error, any>({
    queryKey: ['students'],
    queryFn: studentsService.listStudents
  });

  const students = (studentsResp as any)?.data || [];

  const createStudent = useMutation<any, Error, any>({
    mutationFn: (payload: any) => studentsService.createStudent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'Student created', description: 'New student added.' });
    }
  });

  const updateStudent = useMutation<any, Error, { id: number; payload: any }>({
    mutationFn: (variables: { id: number; payload: any }) => studentsService.updateStudent(variables.id, variables.payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student', variables.id] });
      toast({ title: 'Student updated', description: 'Student information updated.' });
    }
  });

  const deleteStudent = useMutation<any, Error, number>({
    mutationFn: (id: number) => studentsService.deleteStudent(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      toast({ title: 'Student deleted', description: 'Student removed.' });
    }
  });

  return {
    students,
    isLoading,
    error,
    createStudent,
    updateStudent,
    deleteStudent
  };
}

/**
 * Hook for fetching a single student by ID.
 */
export function useStudent(id: number | string) {
  return useQuery<any, Error, any>({
    queryKey: ['student', Number(id)],
    queryFn: () => studentsService.getStudent(Number(id)),
    enabled: !!id
  });
}

/**
 * Standalone hooks for more granular usage if preferred.
 */
export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: (payload: CreateStudentPayload) => studentsService.createStudent(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'Student created', description: 'New student added.' });
    }
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number | string, payload: any }>({
    mutationFn: ({ id, payload }: any) => studentsService.updateStudent(Number(id), payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student', Number(vars.id)] });
      toast({ title: 'Student updated', description: 'Student information updated.' });
    }
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation<any, Error, number | string>({
    mutationFn: (id: number | string) => studentsService.deleteStudent(Number(id)),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student', Number(id)] });
      toast({ title: 'Student deleted', description: 'Student removed.' });
    }
  });
}

export default useStudents;
