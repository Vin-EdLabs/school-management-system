import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function markAttendance(payload: {
  class_id: number;
  student_id: number;
  attendance_date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}): Promise<{ data: any }> {
  return apiService.post(ENDPOINTS.attendance.mark, payload);
}

export async function bulkMarkAttendance(records: Array<{
  class_id: number;
  student_id: number;
  attendance_date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}>): Promise<{ data: any[] }> {
  return apiService.post(ENDPOINTS.attendance.bulkMark, { records });
}

export async function getAttendanceByClass(classId: number, date: string): Promise<{ data: any[] }> {
  return apiService.get(`${ENDPOINTS.attendance.byClass(classId.toString())}?date=${date}`);
}

export async function getAttendanceByClassRange(
  classId: number,
  startDate: string,
  endDate: string
): Promise<{ data: any[] }> {
  return apiService.get(
    `${ENDPOINTS.attendance.byClassRange(classId.toString())}?startDate=${startDate}&endDate=${endDate}`
  );
}

export async function getAttendanceByStudent(
  studentId: number,
  startDate?: string,
  endDate?: string
): Promise<{ data: any[] }> {
  let url = ENDPOINTS.attendance.byStudent(studentId.toString());
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (params.toString()) url += `?${params.toString()}`;
  return apiService.get(url);
}

export async function deleteAttendance(id: number): Promise<{ data: any }> {
  return apiService.delete(ENDPOINTS.attendance.delete(id.toString()));
}

export default {
  markAttendance,
  bulkMarkAttendance,
  getAttendanceByClass,
  getAttendanceByClassRange,
  getAttendanceByStudent,
  deleteAttendance,
};
