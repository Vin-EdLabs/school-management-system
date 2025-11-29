import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as staffService from '@/services/services/staffService';
import { toast } from '@/hooks/use-toast';

export default function useStaffPayroll() {
  const qc = useQueryClient();

  const { data: staffResp } = useQuery(['staff'], staffService.listStaff);
  const staff = staffResp?.data || [];

  const createStaff = useMutation((payload: any) => staffService.createStaff(payload), {
    onSuccess: () => {
      qc.invalidateQueries(['staff']);
      toast({ title: 'Staff added', description: 'Staff member added to payroll.' });
    }
  });

  const updateStaff = useMutation(({ id, payload }: any) => staffService.updateStaff(id, payload), {
    onSuccess: () => {
      qc.invalidateQueries(['staff']);
      toast({ title: 'Staff updated', description: 'Staff details updated.' });
    }
  });

  const deleteStaff = useMutation((id: string) => staffService.deleteStaff(id), {
    onSuccess: () => {
      qc.invalidateQueries(['staff']);
      toast({ title: 'Staff removed', description: 'Staff member removed from payroll.' });
    }
  });

  const payStaff = useMutation(({ id, payload }: any) => staffService.payStaff(id, payload), {
    onSuccess: () => {
      qc.invalidateQueries(['staff']);
      toast({ title: 'Payment recorded', description: 'Staff payment recorded.' });
    }
  });

  return { staff, createStaff, updateStaff, deleteStaff, payStaff };
}
