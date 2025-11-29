import { toast } from '@/hooks/use-toast';
import * as teachersService from '@/services/services/teachersService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useTeachers() {
  const queryClient = useQueryClient();
  const { data: teachersResp } = useQuery<any, Error, any>({ queryKey: ['teachers'], queryFn: teachersService.listTeachers });
  const teachers = (teachersResp as any)?.data || [];

  const createTeacher = useMutation<any, Error, any>({
    mutationFn: (payload: any) => teachersService.createTeacher(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast({ title: 'Teacher created', description: 'New teacher added.' });
    }
  });

  const updateTeacher = useMutation<any, Error, { id: string | number; payload: any }>({
    mutationFn: (variables: { id: string | number; payload: any }) => teachersService.updateTeacher(variables.id, variables.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast({ title: 'Teacher updated', description: 'Teacher updated successfully.' });
    }
  });

  const deleteTeacher = useMutation<any, Error, string | number>({
    mutationFn: (id: string | number) => teachersService.deleteTeacher(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast({ title: 'Teacher deleted', description: 'Teacher removed.' });
    }
  });

  return { teachers, createTeacher, updateTeacher, deleteTeacher };
}

export default useTeachers;

export function useDeleteTeacher() {
  const qc = useQueryClient();
  return useMutation<any, Error, string | number>({
    mutationFn: (id: string | number) => teachersService.deleteTeacher(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teachers'] }),
  });
}
