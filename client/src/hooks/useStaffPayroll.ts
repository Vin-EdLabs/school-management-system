import { toast } from '@/hooks/use-toast';
import * as staffService from '@/services/staffService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export default function useStaffPayroll() {
  const qc = useQueryClient();

  const { data: staffResp } = useQuery<any, Error, any>({ queryKey: ['staff'], queryFn: staffService.listStaff });
  const staff = (staffResp as any)?.data || [];

  const createStaff = useMutation<any, Error, any>({
    mutationFn: (payload: any) => staffService.createStaff(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Staff added', description: 'Staff member added to payroll.' });
    }
  });

  const updateStaff = useMutation<any, Error, any>({
    mutationFn: ({ id, payload }: any) => staffService.updateStaff(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Staff updated', description: 'Staff details updated.' });
    }
  });

  const deleteStaff = useMutation<any, Error, string>({
    mutationFn: (id: string) => staffService.deleteStaff(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Staff removed', description: 'Staff member removed from payroll.' });
    }
  });

  const payStaff = useMutation<any, Error, any>({
    mutationFn: ({ id, payload }: any) => staffService.payStaff(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Payment recorded', description: 'Staff payment recorded.' });
    }
  });

  return { staff, createStaff, updateStaff, deleteStaff, payStaff };
}
