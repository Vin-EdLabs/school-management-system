import { reportService } from '@/services/reportService';
import type { OtherStaffRosterRow, TeacherRosterRow } from './buildStaffRosterPdf';

export function downloadTeacherRosterExcel(
  teachers: TeacherRosterRow[],
  filenamePrefix = 'teacher-roster'
): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  return reportService.exportToCSV(
    teachers.map((row, index) => ({
      '#': index + 1,
      'Teacher Name': row.fullName,
      'Staff ID': row.staffId,
      'Class(es)': row.classes || '',
      Department: row.department || '',
      Salary: row.salary > 0 ? row.salary : '',
      Phone: row.phone || '',
      Email: row.email || '',
    })),
    `${filenamePrefix}-${date}.csv`
  );
}

export function downloadOtherStaffRosterExcel(
  staff: OtherStaffRosterRow[],
  filenamePrefix = 'staff-roster'
): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  return reportService.exportToCSV(
    staff.map((row, index) => ({
      '#': index + 1,
      'Staff Name': row.fullName,
      'Staff ID': row.staffId,
      Position: row.position || '',
      Department: row.department || '',
      Salary: row.salary > 0 ? row.salary : '',
      Phone: row.phone || '',
      Email: row.email || '',
    })),
    `${filenamePrefix}-${date}.csv`
  );
}

export type CombinedStaffRosterRow = {
  fullName: string;
  staffId: string;
  staffType: string;
  position: string;
  department: string;
  phone: string;
  email: string;
  status: string;
};

export function downloadCombinedStaffRosterExcel(
  rows: CombinedStaffRosterRow[],
  filenamePrefix = 'all-staff-roster'
): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  return reportService.exportToCSV(
    rows.map((row, index) => ({
      '#': index + 1,
      Name: row.fullName,
      'Staff ID': row.staffId,
      Type: row.staffType,
      Position: row.position || '',
      Department: row.department || '',
      Phone: row.phone || '',
      Email: row.email || '',
      Status: row.status || '',
    })),
    `${filenamePrefix}-${date}.csv`
  );
}
