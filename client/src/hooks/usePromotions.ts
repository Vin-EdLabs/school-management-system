import { toast } from '@/hooks/use-toast';
import * as classesService from '@/services/services/classesService';
import * as feeStructuresService from '@/services/services/feeStructuresService';
import * as paymentsService from '@/services/services/paymentsService';
import * as studentsService from '@/services/services/studentsService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function usePromotions() {
  const queryClient = useQueryClient();

  const { data: studentsResp } = useQuery(['students'], studentsService.listStudents);
  const { data: classesResp } = useQuery(['classes'], classesService.listClasses);
  const { data: feeStructuresResp } = useQuery(['feeStructures'], feeStructuresService.listFeeStructures);
  const { data: paymentsResp } = useQuery(['payments'], paymentsService.listPayments);

  const studentsRaw = studentsResp?.data || [];
  const classesRaw = classesResp?.data || [];
  const feeStructuresRaw = feeStructuresResp?.data || [];
  const paymentsRaw = paymentsResp?.data || [];

  const classIdToName: Record<number, string> = {};
  classesRaw.forEach((c: any) => {
    classIdToName[c.id] = c.name || c.class_name || c.className || '';
  });

  const classes = classesRaw.map((c: any) => ({
    id: String(c.id),
    className: classIdToName[c.id],
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

  const promoteStudentMutation = useMutation(
    (payload: { id: number; class_id: number }) => studentsService.updateStudent(payload.id, { class_id: payload.class_id }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['students']);
        toast({ title: 'Student Promoted', description: 'Student class updated successfully.' });
      }
    }
  );

  const promoteClassMutation = useMutation(
    (updates: Array<{ id: number; class_id: number }>) => Promise.all(updates.map(u => studentsService.updateStudent(u.id, { class_id: u.class_id }))),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['students']);
        toast({ title: 'Class Promotion', description: 'All students updated successfully.' });
      }
    }
  );

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
