import { toast } from '@/hooks/use-toast';
import * as classesService from '@/services/classesService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useClasses() {
  const queryClient = useQueryClient();

  const { data: classesResp } = useQuery<any, Error, any>({ queryKey: ['classes'], queryFn: classesService.listClasses });
  const classes = (classesResp as any)?.data || [];

  const createClass = useMutation<any, Error, any>({
    mutationFn: (payload: any) => classesService.createClass(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: 'Class created', description: 'New class added.' });
    }
  });

  const updateClass = useMutation<any, Error, { id: number | string; payload: any }>({
    mutationFn: (variables: { id: number | string; payload: any }) => classesService.updateClass(variables.id, variables.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: 'Class updated', description: 'Class updated successfully.' });
    }
  });

  const deleteClass = useMutation<any, Error, number | string>({
    mutationFn: (id: number | string) => classesService.deleteClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: 'Class deleted', description: 'Class removed.' });
    }
  });

  const getClassStudents = async (id: number): Promise<any[]> => {
    const res = await classesService.getClassStudents(id) as { data?: any[] } | undefined;
    return res?.data || [];
  };

  return {
    classes,
    createClass,
    updateClass,
    deleteClass,
    getClassStudents
  };
}

export default useClasses;

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: (payload: any) => classesService.createClass(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}

export function useClass(id: number) {
  return useQuery<any, Error, any>({ queryKey: ['class', id], queryFn: () => classesService.getClass(id) });
}

export function useClassStudents(id: number) {
  return useQuery<any, Error, any>({ queryKey: ['class', id, 'students'], queryFn: () => classesService.getClassStudents(id) });
}
