import { toast } from '@/hooks/use-toast';
import * as assignmentsService from '@/services/assignmentsService';
import * as classesService from '@/services/classesService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function useClasses() {
  const queryClient = useQueryClient();

  const { data: classesResp } = useQuery<any, Error, any>({ queryKey: ['classes'], queryFn: classesService.listClasses });
  const rawClasses = (classesResp as any)?.data || [];
  // Try to reuse any previously-enriched classes cached in React Query to avoid
  // refetching assignments for every hook instance.
  const cachedEnriched = queryClient.getQueryData<any[]>(['classes', 'enriched']);
  const [classes, setClasses] = useState<any[]>(cachedEnriched ?? rawClasses ?? []);

  useEffect(() => {
    let mounted = true;
    const enrich = async () => {
      try {
        const enriched = await Promise.all(rawClasses.map(async (cls: any) => {
          try {
            const res = await assignmentsService.listByClass(cls.id);
            const teachers = (res as any)?.data || [];
            const teacher = teachers[0];
            const assignedTeacherId = teacher ? teacher.id ?? teacher.ID ?? teacher.user_id ?? null : null;
            const assignedTeacherName = teacher ? (teacher.fullName ?? teacher.full_name ?? teacher.username ?? null) : null;
            return { ...cls, assignedTeacher: assignedTeacherId, assignedTeacherName };
          } catch (e) {
            return { ...cls, assignedTeacher: null };
          }
        }));
        if (mounted) {
          setClasses(enriched);
          // Cache enriched classes so other hook instances can reuse them without
          // making duplicate assignment API calls.
          try { queryClient.setQueryData(['classes', 'enriched'], enriched); } catch (e) { /* ignore */ }
        }
      } catch (e) {
        if (mounted) setClasses(rawClasses);
      }
    };
    if (rawClasses.length > 0) enrich();
    else {
      setClasses(rawClasses);
      try { queryClient.setQueryData(['classes', 'enriched'], rawClasses); } catch (e) { /* ignore */ }
    }
    return () => { mounted = false; };
  }, [classesResp]);

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
