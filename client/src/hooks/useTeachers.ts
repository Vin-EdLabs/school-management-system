import { toast } from '@/hooks/use-toast';
import * as assignmentsService from '@/services/assignmentsService';
import * as teachersService from '@/services/teachersService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function useTeachers() {
  const queryClient = useQueryClient();
  const { data: teachersResp } = useQuery<any, Error, any>({ queryKey: ['teachers'], queryFn: teachersService.listTeachers });
  const rawTeachers = (teachersResp as any)?.data || [];
  const [teachers, setTeachers] = useState<any[]>(rawTeachers || []);

  // Enrich teachers with classAssigned by querying assignments for each teacher
  useEffect(() => {
    let mounted = true;
    const enrich = async () => {
      try {
        const enriched = await Promise.all(rawTeachers.map(async (t: any) => {
          try {
            const res = await assignmentsService.listByTeacher(t.id);
            const classes = (res as any)?.data || [];
            const cls = classes[0];
            const classAssigned = cls ? (cls.className ?? (cls.level ? `${cls.level}${cls.stream ? ' ' + cls.stream : ''}` : '')) : undefined;
            return { ...t, classAssigned };
          } catch (e) {
            return { ...t, classAssigned: undefined };
          }
        }));
        if (mounted) setTeachers(enriched);
      } catch (e) {
        if (mounted) setTeachers(rawTeachers);
      }
    };
    if (rawTeachers.length > 0) enrich();
    else setTeachers(rawTeachers);
    return () => { mounted = false; };
  }, [teachersResp]);

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
