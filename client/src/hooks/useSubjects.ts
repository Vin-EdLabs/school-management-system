import * as subjectsService from '@/services/subjectsService';
import { useQuery } from '@tanstack/react-query';

export function useSubjects() {
  const { data } = useQuery({ queryKey: ['subjects'], queryFn: () => subjectsService.listSubjects() });
  return { subjects: (data as any)?.data || [] };
}

export default useSubjects;
