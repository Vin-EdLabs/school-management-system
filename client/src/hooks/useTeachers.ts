import { toast } from '@/hooks/use-toast';
import * as assignmentsService from '@/services/assignmentsService';
import * as teachersService from '@/services/teachersService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Hook for managing school teachers.
 * Includes "enrichment" with class assignments managed via TanStack Query.
 */
export function useTeachers() {
  const queryClient = useQueryClient();

  // Primary query for teachers with enrichment logic inside queryFn
  const { data: teachers = [], isLoading, error, refetch: refreshTeachers } = useQuery<any, Error, any[]>({
    queryKey: ['teachers', 'enriched'],
    queryFn: async () => {
      const resp = await teachersService.listTeachers();
      const rawTeachers = resp.data || resp || [];

      // Enrich each teacher with their class assignments
      const enriched = await Promise.all(
        rawTeachers.map(async (t: any) => {
          try {
            const res = await assignmentsService.listByTeacher(t.id);
            const classes = (res as any)?.data || [];

            const assignedLabels: string[] = [];
            const assignedIds: Array<string | number> = [];

            for (const cls of classes) {
              if (!cls) continue;
              const classNameField = cls.className ?? cls.name ?? cls.class_name ?? cls.title ?? null;
              const label = classNameField ?? (cls.level ? `${cls.level}${cls.stream ? ' ' + cls.stream : ''}` : `Class ${cls.id ?? ''}`);
              assignedLabels.push(String(label));
              assignedIds.push(cls.id ?? cls.ID ?? cls.class_id ?? cls.classId ?? '');
            }

            const classAssigned = assignedLabels.length > 0 ? assignedLabels.join(', ') : undefined;
            const classAssignedId = assignedIds.length === 1 ? assignedIds[0] : null;

            return {
              ...t,
              classAssigned,
              classAssignedList: assignedLabels,
              classAssignedId,
              classAssignedIds: assignedIds
            };
          } catch (e) {
            return {
              ...t,
              classAssigned: undefined,
              classAssignedId: null,
              classAssignedList: [],
              classAssignedIds: []
            };
          }
        })
      );

      return enriched;
    },
    // Standard stale-time applies, but we allow manual refresh from the return object
  });

  const createTeacher = useMutation<any, Error, any>({
    mutationFn: (payload: any) => teachersService.createTeacher(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast({ title: 'Teacher created', description: 'New teacher added.' });
    }
  });

  const updateTeacher = useMutation<any, Error, { id: string | number; payload: any }>({
    mutationFn: (variables: { id: string | number; payload: any }) =>
      teachersService.updateTeacher(variables.id, variables.payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', variables.id] });
      toast({ title: 'Teacher updated', description: 'Teacher updated successfully.' });
    }
  });

  const deleteTeacher = useMutation<any, Error, string | number>({
    mutationFn: (id: string | number) => teachersService.deleteTeacher(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', id] });
      toast({ title: 'Teacher deleted', description: 'Teacher removed.' });
    }
  });

  return {
    teachers,
    isLoading,
    error,
    createTeacher,
    updateTeacher,
    deleteTeacher,
    refreshTeachers
  };
}

/**
 * Use this for a specific teacher.
 */
export function useTeacher(id: number | string) {
  return useQuery<any, Error, any>({
    queryKey: ['teacher', Number(id)],
    queryFn: () => teachersService.getTeacher(Number(id)),
    enabled: !!id
  });
}

/**
 * Standalone delete teacher hook for consistency.
 */
export function useDeleteTeacher() {
  const qc = useQueryClient();
  return useMutation<any, Error, string | number>({
    mutationFn: (id: string | number) => teachersService.deleteTeacher(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['teachers'] });
      qc.invalidateQueries({ queryKey: ['teacher', id] });
    }
  });
}

export default useTeachers;
