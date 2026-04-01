import * as schedulesService from '@/services/schedulesService';
import { useQuery } from '@tanstack/react-query';

export function useSchedulesForTeacher(teacherId?: string | number) {
  return useQuery({ queryKey: ['schedules', 'teacher', teacherId], queryFn: () => schedulesService.listByTeacher(teacherId ?? 0), enabled: !!teacherId });
}

export function useSchedulesForClass(classId?: string | number) {
  return useQuery({ queryKey: ['schedules', 'class', classId], queryFn: () => schedulesService.listByClass(classId ?? 0), enabled: !!classId });
}

export function useAllSchedules() {
  return useQuery({ queryKey: ['schedules', 'all'], queryFn: schedulesService.listAll });
}

export default useSchedulesForTeacher;
