import { toast } from '@/hooks/use-toast';
import * as teachersService from '@/services/services/teachersService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useTeachers() {
  const queryClient = useQueryClient();

  const { data: teachersResp } = useQuery(['teachers'], teachersService.listTeachers);
  const teachers = teachersResp?.data || [];

  const createTeacher = useMutation((payload: any) => teachersService.createTeacher(payload), {
    onSuccess: () => {
      queryClient.invalidateQueries(['teachers']);
      toast({ title: 'Teacher created', description: 'New teacher added.' });
    }
  });

  const updateTeacher = useMutation((variables: { id: string | number; payload: any }) => teachersService.updateTeacher(variables.id, variables.payload), {
    onSuccess: () => {
      queryClient.invalidateQueries(['teachers']);
      toast({ title: 'Teacher updated', description: 'Teacher updated successfully.' });
    }
  });

  const deleteTeacher = useMutation((id: string | number) => teachersService.deleteTeacher(id), {
    onSuccess: () => {
      queryClient.invalidateQueries(['teachers']);
      toast({ title: 'Teacher deleted', description: 'Teacher removed.' });
    }
  });

  return { teachers, createTeacher, updateTeacher, deleteTeacher };
}

export default useTeachers;
