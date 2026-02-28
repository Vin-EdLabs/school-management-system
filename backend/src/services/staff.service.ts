
import bcrypt from 'bcrypt';
import * as repo from '../repositories/staff.repository.js';
import { getMaxStaffId as getGlobalMaxStaffId } from '../repositories/user.repository.js';

export async function listStaff() {
  return repo.listStaff();
}

export async function getStaff(id: number) {
  return repo.findStaffById(id);
}

export async function getNextStaffId(): Promise<string> {
  const max = await getGlobalMaxStaffId();
  return String((max ?? 0) + 1).padStart(5, '0');
}

export async function createStaff(payload: any) {
  // Hash password and delegate to repository which now handles dedicated columns
  let staffId = payload.staffId ?? payload.staff_id ?? '';
  if (!staffId) staffId = await getNextStaffId();
  const password = payload.password ?? staffId;
  const hash = await bcrypt.hash(password, 10);

  // ensure numerical fields are mapped correctly
  const data = {
    ...payload,
    staff_id: staffId,
    password_hash: hash,
    monthly_salary: payload.monthly_salary ?? payload.monthlySalary ?? 0
  };

  return repo.createStaff(data);
}

export async function updateStaff(id: number, payload: any) {
  return repo.updateStaff(id, payload);
}

export async function deleteStaff(id: number) {
  return repo.deleteStaff(id);
}

export async function payStaff(id: number, date: string) {
  // Update notes or a dedicated last_paid field if available
  // For now, update staff with notes about the payment
  const staff = await repo.findStaffById(id);
  if (!staff) return null;

  return repo.updateStaff(id, { notes: (staff.notes ? staff.notes + "\n" : "") + `Last paid on ${date}` });
}

export default { listStaff, getStaff, createStaff, updateStaff, deleteStaff, payStaff };
