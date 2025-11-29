import { toast } from '@/hooks/use-toast';
import * as classesService from '@/services/services/classesService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useClasses() {
  const queryClient = useQueryClient();

  const { data: classesResp } = useQuery(['classes'], classesService.listClasses);
  const classes = classesResp?.data || [];

  const createClass = useMutation((payload: any) => classesService.createClass(payload), {
    onSuccess: () => {
      queryClient.invalidateQueries(['classes']);
      toast({ title: 'Class created', description: 'New class added.' });
    }
  });

  const updateClass = useMutation((variables: { id: number | string; payload: any }) => classesService.updateClass(variables.id, variables.payload), {
    onSuccess: () => {
      queryClient.invalidateQueries(['classes']);
      toast({ title: 'Class updated', description: 'Class updated successfully.' });
    }
  });

  const deleteClass = useMutation((id: number | string) => classesService.deleteClass(id), {
    onSuccess: () => {
      queryClient.invalidateQueries(['classes']);
      toast({ title: 'Class deleted', description: 'Class removed.' });
    }
  });

  const getClassStudents = async (id: number) => {
    const res = await classesService.getClassStudents(id);
    return res?.data || [];
  };

  return {
    classes,
    createClass,
    getClassStudents,
    updateClass,
    deleteClass
  };
}

export default useClasses;

export function useClasses() {
  return useQuery(['classes'], () => classesService.listClasses());
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation((payload: any) => classesService.createClass(payload), {
    onSuccess: () => qc.invalidateQueries(['classes']),
  });
}

export function useClass(id: number) {
  return useQuery(['class', id], () => classesService.getClass(id));
}

export function useClassStudents(id: number) {
  return useQuery(['class', id, 'students'], () => classesService.getClassStudents(id));
}
