import { apiService } from './api';

export type StudentCharge = {
  id: number;
  tenantId: number;
  studentId: number;
  academicYearId: number;
  termId: number;
  description: string;
  amount: number;
  reason: string | null;
  createdByUserId: number | null;
  createdByName: string | null;
  createdAt: string;
  status: 'unpaid' | 'paid';
  paidAt: string | null;
  ledgerEntryId: number | null;
  paymentId: number | null;
};

export async function createStudentCharge(input: {
  student_id: number;
  description: string;
  amount: number;
  reason?: string;
}): Promise<StudentCharge> {
  return apiService.post<StudentCharge>('/finance/student-charges', input);
}

export async function fetchStudentCharges(
  studentId: number | string,
  termId?: number | null
): Promise<StudentCharge[]> {
  const params = new URLSearchParams();
  if (termId != null) params.set('term_id', String(termId));
  const qs = params.toString();
  return apiService.get<StudentCharge[]>(
    `/finance/student-charges/student/${encodeURIComponent(String(studentId))}${qs ? `?${qs}` : ''}`
  );
}

export async function deleteStudentCharge(chargeId: number): Promise<void> {
  await apiService.delete(`/finance/student-charges/${chargeId}`);
}

export const BILL_STUDENT_INFO_DISMISSED_KEY = 'scholarnerve.billStudentInfoDismissed';
