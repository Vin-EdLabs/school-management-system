import { toast } from '@/hooks/use-toast';
import * as studentsService from '@/services/services/studentsService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStudentPayload } from '../types/student';

export function useStudents() {
  const queryClient = useQueryClient();
  const { data: studentsResp } = useQuery<any, Error, any>({ queryKey: ['students'], queryFn: studentsService.listStudents });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'Student updated', description: 'Student information updated.' });
    }
  });

  const deleteStudent = useMutation<any, Error, number>({
    mutationFn: (id: number) => studentsService.deleteStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'Student deleted', description: 'Student removed.' });
    }
  });

  return {
    students,
    createStudent,
    updateStudent,
    deleteStudent
  };
}

export default useStudents;

// If other modules need single-query hooks, define them with different names
export function useStudentsQuery() {
  return useQuery<any, Error, any>({ queryKey: ['students'], queryFn: () => studentsService.listStudents() });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({ mutationFn: (payload: CreateStudentPayload) => studentsService.createStudent(payload), onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }) });
}

export function useStudent(id: number) {
  return useQuery<any, Error, any>({ queryKey: ['student', id], queryFn: () => studentsService.getStudent(id) });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({ mutationFn: ({ id, payload }: any) => studentsService.updateStudent(id, payload), onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['student', vars.id] }) });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation<any, Error, number>({ mutationFn: (id: number) => studentsService.deleteStudent(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }) });
}
