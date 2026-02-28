import { toast } from '@/hooks/use-toast';
import * as assignmentsService from '@/services/assignmentsService';
import * as classesService from '@/services/classesService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Hook for managing school classes.
 * Includes "enrichment" with teacher assignments managed via TanStack Query.
 */
export function useClasses() {
  const queryClient = useQueryClient();

  // Primary query for classes with enrichment logic inside queryFn
  const { data: classes = [], isLoading, error } = useQuery<any, Error, any[]>({
    queryKey: ['classes', 'enriched'],
    queryFn: async () => {
      const resp = await classesService.listClasses();
      const rawClasses = resp.data || resp || [];

      // Enrich each class with its teacher assignments
      const enriched = await Promise.all(
        rawClasses.map(async (cls: any) => {
          try {
            const res = await assignmentsService.listByClass(cls.id);
            const teachers = (res as any)?.data || [];

            const assignedTeacherIds: (string | number)[] = teachers.map((t: any) => t.id).filter(Boolean);
            const assignedTeacherNames: string[] = teachers
              .map((t: any) => t.display_name ?? t.fullName ?? t.full_name ?? null)
              .filter(Boolean);

            const firstTeacher = teachers[0] ?? null;

            return {
              ...cls,
              assignedTeacher: firstTeacher?.id ?? null,
              assignedTeacherName: firstTeacher?.display_name ?? firstTeacher?.fullName ?? null,
              assignedTeacherIds,
              assignedTeacherNames
            };
          } catch (e) {
            return {
              ...cls,
              assignedTeacher: null,
              assignedTeacherIds: [],
              assignedTeacherNames: []
            };
          }
        })
      );

      return enriched;
    },
    // We keep the data for 5 minutes (default) but allow manual invalidation
  });

  const createClass = useMutation<any, Error, any>({
    mutationFn: (payload: any) => classesService.createClass(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: 'Class created', description: 'New class added.' });
    }
  });

  const updateClass = useMutation<any, Error, { id: number | string; payload: any }>({
    mutationFn: (variables: { id: number | string; payload: any }) =>
      classesService.updateClass(variables.id, variables.payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['class', variables.id] });
      toast({ title: 'Class updated', description: 'Class updated successfully.' });
    }
  });

  const deleteClass = useMutation<any, Error, number | string>({
    mutationFn: (id: number | string) => classesService.deleteClass(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['class', id] });
      toast({ title: 'Class deleted', description: 'Class removed.' });
    }
  });

  return {
    classes,
    isLoading,
    error,
    createClass,
    updateClass,
    deleteClass
  };
}

/**
 * Use this for a specific class with its students.
 */
export function useClass(id: number | string) {
  return useQuery<any, Error, any>({
    queryKey: ['class', Number(id)],
    queryFn: () => classesService.getClass(Number(id)),
    enabled: !!id
  });
}

/**
 * Use this for class students.
 */
export function useClassStudents(id: number | string) {
  return useQuery<any, Error, any[]>({
    queryKey: ['class', Number(id), 'students'],
    queryFn: async () => {
      const res = await classesService.getClassStudents(Number(id));
      return (res as any)?.data || [];
    },
    enabled: !!id
  });
}

/**
 * Standalone create class hook.
 */
export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: (payload: any) => classesService.createClass(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: 'Class created', description: 'New class added.' });
    }
  });
}

export default useClasses;
