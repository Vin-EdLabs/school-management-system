import * as subjectsService from '@/services/subjectsService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

export function useSubjects() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['subjects'], queryFn: () => subjectsService.listSubjects() });

  const createSubject = useMutation({
    mutationFn: subjectsService.createSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast({ title: 'Success', description: 'Subject added successfully.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.message || 'Failed to add subject.', variant: 'destructive' });
    }
  });

  const deleteSubject = useMutation({
    mutationFn: subjectsService.deleteSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast({ title: 'Success', description: 'Subject deleted successfully.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.response?.data?.message || 'Failed to delete subject.', variant: 'destructive' });
    }
  });

  return {
    subjects: (data as any)?.data || [],
    isLoading,
    createSubject,
    deleteSubject
  };
}

export default useSubjects;
