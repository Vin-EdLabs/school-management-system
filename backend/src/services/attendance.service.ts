import * as repo from '../repositories/attendance.repository.js';

interface AttendancePayload {
  class_id: number;
  student_id: number;
  attendance_date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  marked_by: number;
  notes?: string;
}

export async function markAttendance(payload: AttendancePayload) {
  return repo.markAttendance(payload);
}

export async function bulkMarkAttendance(records: AttendancePayload[]) {
  return repo.bulkMarkAttendance(records);
}

export async function getAttendanceByClass(classId: number, date: string) {
  return repo.getAttendanceByClass(classId, date);
}

export async function getAttendanceByStudent(studentId: number, startDate?: string, endDate?: string) {
  return repo.getAttendanceByStudent(studentId, startDate, endDate);
}

export async function getAttendanceByDateRange(classId: number, startDate: string, endDate: string) {
  return repo.getAttendanceByDateRange(classId, startDate, endDate);
}

export async function deleteAttendance(id: number) {
  return repo.deleteAttendance(id);
}

export default {
  markAttendance,
  bulkMarkAttendance,
  getAttendanceByClass,
  getAttendanceByStudent,
  getAttendanceByDateRange,
  deleteAttendance
};
