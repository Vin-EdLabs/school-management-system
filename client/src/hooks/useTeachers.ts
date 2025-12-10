import { toast } from '@/hooks/use-toast';
import * as assignmentsService from '@/services/assignmentsService';
import * as teachersService from '@/services/teachersService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function useTeachers() {
  const queryClient = useQueryClient();
  const { data: teachersResp } = useQuery<any, Error, any>({ queryKey: ['teachers'], queryFn: teachersService.listTeachers });
  const rawTeachers = (teachersResp as any)?.data || [];
  // Try to reuse any previously-enriched teachers cached in React Query
  const cachedEnriched = queryClient.getQueryData<any[]>(['teachers', 'enriched']);
  const [teachers, setTeachers] = useState<any[]>(cachedEnriched ?? rawTeachers ?? []);

  // Enrich teachers with classAssigned by querying assignments for each teacher
  // Extraction: a function that enriches a list of raw teachers by fetching assignments
  const enrichTeachers = async (sourceTeachers: any[]) => {
    const enriched = await Promise.all(sourceTeachers.map(async (t: any) => {
      try {
        const res = await assignmentsService.listByTeacher(t.id);
        const classes = (res as any)?.data || [];
        const assignedLabels: string[] = [];
        const assignedIds: Array<string|number> = [];
        for (const cls of classes) {
          if (!cls) continue;
          const classNameField = cls.className ?? cls.name ?? cls.class_name ?? cls.title ?? null;
          const label = classNameField ?? (cls.level ? `${cls.level}${cls.stream ? ' ' + cls.stream : ''}` : `Class ${cls.id ?? ''}`);
          assignedLabels.push(String(label));
          assignedIds.push(cls.id ?? cls.ID ?? cls.class_id ?? cls.classId ?? '');
        }
        const classAssigned = assignedLabels.length > 0 ? assignedLabels.join(', ') : undefined;
        const classAssignedId = assignedIds.length === 1 ? assignedIds[0] : null;
        return { ...t, classAssigned, classAssignedList: assignedLabels, classAssignedId, classAssignedIds: assignedIds };
      } catch (e) {
        return { ...t, classAssigned: undefined, classAssignedId: null };
      }
    }));
    return enriched;
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if ((rawTeachers || []).length === 0) {
        setTeachers(rawTeachers);
        try { queryClient.setQueryData(['teachers', 'enriched'], rawTeachers); } catch (e) { }
        return;
      }
      try {
        const enriched = await enrichTeachers(rawTeachers);
        if (!mounted) return;
        setTeachers(enriched);
        try { queryClient.setQueryData(['teachers', 'enriched'], enriched); } catch (e) { }
      } catch (e) {
        if (!mounted) return;
        setTeachers(rawTeachers);
        try { queryClient.setQueryData(['teachers', 'enriched'], rawTeachers); } catch (e) { }
      }
    };
    run();
    return () => { mounted = false; };
  }, [teachersResp]);

  // expose a refresh function that UI components can call after assign/remove
  const refreshTeachers = async () => {
    const latest = queryClient.getQueryData<any[]>(['teachers']) || rawTeachers || [];
    const enriched = await enrichTeachers(latest);
    setTeachers(enriched);
    try { queryClient.setQueryData(['teachers', 'enriched'], enriched); } catch (e) { }
  };

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

  return { teachers, createTeacher, updateTeacher, deleteTeacher, refreshTeachers };
}

export default useTeachers;

export function useDeleteTeacher() {
  const qc = useQueryClient();
  return useMutation<any, Error, string | number>({
    mutationFn: (id: string | number) => teachersService.deleteTeacher(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teachers'] }),
  });
}
