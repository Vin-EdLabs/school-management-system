import { toast } from '@/hooks/use-toast';
import * as studentsService from '@/services/services/studentsService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStudentPayload } from '../types/student';

export function useStudents() {
  const queryClient = useQueryClient();

  const { data: studentsResp } = useQuery(['students'], studentsService.listStudents);
  const students = studentsResp?.data || [];

  const createStudent = useMutation((payload: any) => studentsService.createStudent(payload), {
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
      toast({ title: 'Student created', description: 'New student added.' });
    }
  });

  const updateStudent = useMutation((variables: { id: number; payload: any }) => studentsService.updateStudent(variables.id, variables.payload), {
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
      toast({ title: 'Student updated', description: 'Student information updated.' });
    }
  });

  const deleteStudent = useMutation((id: number) => studentsService.deleteStudent(id), {
    onSuccess: () => {
      queryClient.invalidateQueries(['students']);
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

export function useStudents() {
  return useQuery(['students'], () => studentsService.listStudents());
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation((payload: CreateStudentPayload) => studentsService.createStudent(payload), {
    onSuccess: () => qc.invalidateQueries(['students']),
  });
}

export function useStudent(id: number) {
  return useQuery(['student', id], () => studentsService.getStudent(id));
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation(({ id, payload }: any) => studentsService.updateStudent(id, payload), {
    onSuccess: (_data, vars) => qc.invalidateQueries(['student', vars.id]),
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation((id: number) => studentsService.deleteStudent(id), {
    onSuccess: () => qc.invalidateQueries(['students']),
  });
}
