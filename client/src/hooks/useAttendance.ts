import { toast } from '@/hooks/use-toast';
import * as attendanceService from '@/services/attendanceService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface AttendanceRecord {
  id?: number;
  class_id: number;
  student_id: number;
  attendance_date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  marked_by?: number;
  created_at?: string;
  updated_at?: string;
}

export function useAttendance(classId?: number, date?: string) {
  const queryClient = useQueryClient();

  // Fetch attendance for a specific class and date
  const {
    data: attendanceResp,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['attendance', classId, date],
    queryFn: () => {
      if (!classId || !date) return Promise.resolve({ data: [] });
      return attendanceService.getAttendanceByClass(Number(classId), date);
    },
    enabled: !!classId && !!date,
  });

  const attendance = (attendanceResp as any)?.data || [];

  // Mark single attendance
  const markAttendanceMutation = useMutation({
    mutationFn: (payload: Omit<AttendanceRecord, 'id'>) =>
      attendanceService.markAttendance(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({
        title: 'Success',
        description: 'Attendance marked successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to mark attendance',
        variant: 'destructive',
      });
    },
  });

  // Bulk mark attendance
  const bulkMarkAttendanceMutation = useMutation({
    mutationFn: (records: Array<Omit<AttendanceRecord, 'id'>>) =>
      attendanceService.bulkMarkAttendance(records),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({
        title: 'Success',
        description: 'Attendance saved successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to save attendance',
        variant: 'destructive',
      });
    },
  });

  // Delete attendance
  const deleteAttendanceMutation = useMutation({
    mutationFn: (id: number) => attendanceService.deleteAttendance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({
        title: 'Success',
        description: 'Attendance record deleted',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete attendance',
        variant: 'destructive',
      });
    },
  });

  return {
    attendance,
    isLoading,
    error,
    refetch,
    markAttendance: markAttendanceMutation.mutate,
    bulkMarkAttendance: bulkMarkAttendanceMutation.mutate,
    deleteAttendance: deleteAttendanceMutation.mutate,
    isMarking: markAttendanceMutation.isPending,
    isBulkMarking: bulkMarkAttendanceMutation.isPending,
    isDeleting: deleteAttendanceMutation.isPending,
  };
}

// Hook for fetching attendance by student
export function useStudentAttendance(
  studentId?: number,
  startDate?: string,
  endDate?: string
) {
  const { data: attendanceResp, isLoading, error } = useQuery({
    queryKey: ['attendance', 'student', studentId, startDate, endDate],
    queryFn: () => {
      if (!studentId) return Promise.resolve({ data: [] });
      return attendanceService.getAttendanceByStudent(
        Number(studentId),
        startDate,
        endDate
      );
    },
    enabled: !!studentId,
  });

  const attendance = (attendanceResp as any)?.data || [];

  return {
    attendance,
    isLoading,
    error,
  };
}

// Hook for fetching attendance by class date range
export function useClassAttendanceRange(
  classId?: number,
  startDate?: string,
  endDate?: string
) {
  const { data: attendanceResp, isLoading, error } = useQuery({
    queryKey: ['attendance', 'range', classId, startDate, endDate],
    queryFn: () => {
      if (!classId || !startDate || !endDate) return Promise.resolve({ data: [] });
      return attendanceService.getAttendanceByClassRange(
        Number(classId),
        startDate,
        endDate
      );
    },
    enabled: !!classId && !!startDate && !!endDate,
  });

  const attendance = (attendanceResp as any)?.data || [];

  return {
    attendance,
    isLoading,
    error,
  };
}

export default useAttendance;
