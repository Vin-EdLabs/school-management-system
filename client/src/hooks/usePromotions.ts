import { toast } from '@/hooks/use-toast';
import * as classesService from '@/services/classesService';
import * as feeStructuresService from '@/services/feeStructuresService';
import * as paymentsService from '@/services/paymentsService';
import * as studentsService from '@/services/studentsService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function usePromotions() {
  const queryClient = useQueryClient();

  const { data: studentsResp } = useQuery<any, Error, any>({ queryKey: ['students'], queryFn: studentsService.listStudents });
  const { data: classesResp } = useQuery<any, Error, any>({ queryKey: ['classes'], queryFn: classesService.listClasses });
  const { data: feeStructuresResp } = useQuery<any, Error, any>({ queryKey: ['feeStructures'], queryFn: feeStructuresService.listFeeStructures });
  const { data: paymentsResp } = useQuery<any, Error, any>({ queryKey: ['payments'], queryFn: paymentsService.listPayments });

  const studentsRaw = (studentsResp as any)?.data || [];
  const classesRaw = (classesResp as any)?.data || [];
  const feeStructuresRaw = (feeStructuresResp as any)?.data || [];
  const paymentsRaw = (paymentsResp as any)?.data || [];

  const classIdToName: Record<number, string> = {};
  classesRaw.forEach((c: any) => {
    const level = c.level || c.grade || '';
    const stream = c.stream || '';
    const derived = stream ? `${level} ${stream}` : level;
    classIdToName[c.id] = derived;
  });

  const classes = classesRaw.map((c: any) => ({
    id: String(c.id),
    className: classIdToName[c.id] || '',
    level: c.level || c.grade || '',
    maxClassSize: c.maxClassSize ?? c.max_class_size ?? c.capacity ?? null,
    stream: c.stream || null
  }));

  const students = studentsRaw.map((s: any) => ({
    id: String(s.id),
    firstName: s.first_name || s.firstName || '',
    lastName: s.last_name || s.lastName || '',
    classAssigned: classIdToName[s.class_id] || s.class_assigned || s.classAssigned || ''
  }));

  const feeStructures = feeStructuresRaw.map((f: any) => ({
    ...f,
    className: classIdToName[f.class_id] || f.className || f.class_name || '',
    term: f.term || f.term_name || f.termName || ''
  }));

  const payments = paymentsRaw.map((p: any) => ({
    studentId: String(p.student_id || p.studentId || p.student),
    term: p.term || p.term_name || p.termName || '',
    amount: Number(p.amount || 0)
  }));

  const promoteStudentMutation = useMutation<any, Error, { id: number; class_id: number }>({
    mutationFn: (payload: { id: number; class_id: number }) => studentsService.updateStudent(payload.id, ({ class_id: payload.class_id } as any)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'Student Promoted', description: 'Student class updated successfully.' });
    }
  });

  const promoteClassMutation = useMutation<any, Error, Array<{ id: number; class_id: number }>>({
    mutationFn: (updates: Array<{ id: number; class_id: number }>) => Promise.all(updates.map(u => studentsService.updateStudent(u.id, ({ class_id: u.class_id } as any)))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'Class Promotion', description: 'All students updated successfully.' });
    }
  });

  return {
    students,
    classes,
    feeStructures,
    payments,
    classIdToName,
    promoteStudentMutation,
    promoteClassMutation
  };
}

export default usePromotions;
