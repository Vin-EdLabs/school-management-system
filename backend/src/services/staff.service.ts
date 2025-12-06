import bcrypt from 'bcrypt';
import * as repo from '../repositories/staff.repository.js';
import * as userRepo from '../repositories/user.repository.js';

export async function listStaff() {
  const rows = await repo.listStaff();
  // merge meta into top-level shape for frontend compatibility
  return rows.map((r: any) => ({ id: r.id, username: r.username, role: r.role, created_at: r.created_at, ...(r.meta ?? {}) }));
}

export async function getStaff(id: number) {
  const r = await repo.findStaffById(id);
  if (!r) return null;
  return { id: r.id, username: r.username, role: r.role, created_at: r.created_at, ...(r.meta ?? {}) };
}

export async function createStaff(payload: any) {
  // Build profile meta from payload and create user via user repository
  const password = payload.password ?? '';
  const hash = await bcrypt.hash(password, 10);
  const meta = {
    name: payload.name ?? payload.fullName ?? payload.full_name ?? '',
    position: payload.position ?? payload.title ?? '',
    monthlySalary: payload.monthlySalary ?? payload.monthly_salary ?? 0,
    gender: payload.gender ?? '',
    dateOfBirth: payload.dateOfBirth ?? payload.date_of_birth ?? null,
    phoneNumber: payload.phoneNumber ?? payload.phone_number ?? '',
    email: payload.email ?? '',
    address: payload.address ?? '',
    employmentDate: payload.employmentDate ?? payload.employment_date ?? null,
    employmentStatus: payload.employmentStatus ?? payload.employment_status ?? 'Active',
    department: payload.department ?? '',
    notes: payload.notes ?? ''
  };
  const created = await userRepo.createUser(payload.username, hash, 'staff', meta);
  if (!created) throw new Error('Failed to create staff member');
  // return merged object to match frontend expectations
  return { id: created.id, username: created.username, role: created.role, created_at: created.created_at, ...meta };
}

export async function updateStaff(id: number, payload: any) {
  return repo.updateStaff(id, payload);
}

export async function deleteStaff(id: number) {
  return repo.deleteStaff(id);
}

export async function payStaff(id: number, date: string) {
  // Get current staff member
  const staff = await repo.findStaffById(id);
  if (!staff) return null;
  
  // Update meta with lastPaid date
  const updatedMeta = {
    ...staff.meta,
    lastPaid: date
  };
  
  return repo.updateStaff(id, { meta: updatedMeta });
}

export default { listStaff, getStaff, createStaff, updateStaff, deleteStaff, payStaff };
