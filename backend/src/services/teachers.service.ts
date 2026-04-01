import bcrypt from 'bcrypt';
import * as repo from '../repositories/teachers.repository.js';
import { getMaxStaffId as getGlobalMaxStaffId } from '../repositories/user.repository.js';

// Shape the DB row into a client-friendly object (no meta)
function toPublic(r: any) {
  if (!r) return null;
  return {
    id: r.id,
    staffId: r.staff_id,
    staff_id: r.staff_id,
    role: r.role,
    fullName: r.display_name,       // canonical name field for frontend
    display_name: r.display_name,
    email: r.email,
    phone: r.phone,
    gender: r.gender,
    dateOfBirth: r.date_of_birth,
    address: r.address,
    employmentDate: r.employment_date,
    employmentStatus: r.employment_status ?? 'Active',
    monthlySalary: r.monthly_salary ?? 0,
    notes: r.notes,
    subjectsTaught: r.subjects_taught ?? [],
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function listTeachers() {
  const rows = await repo.listTeachers();
  return rows.map(toPublic);
}

export async function getTeacher(id: number) {
  return toPublic(await repo.findTeacherById(id));
}

export async function getNextStaffId(): Promise<string> {
  const max = await getGlobalMaxStaffId();
  return String((max ?? 0) + 1).padStart(5, '0');
}

export async function createTeacher(payload: any) {
  let staffId = payload.staffId ?? payload.staff_id ?? '';
  if (!staffId) staffId = await getNextStaffId();

  const password = payload.password ?? staffId;
  const hash = await bcrypt.hash(password, 10);

  const created = await repo.createTeacher({
    staff_id: staffId,
    password_hash: hash,
    display_name: payload.fullName ?? payload.display_name ?? payload.full_name ?? null,
    email: payload.email ?? null,
    phone: payload.phoneNumber ?? payload.phone ?? null,
    gender: payload.gender ?? null,
    date_of_birth: payload.dateOfBirth ?? payload.date_of_birth ?? null,
    address: payload.address ?? null,
    employment_date: payload.employmentDate ?? payload.employment_date ?? null,
    employment_status: payload.employmentStatus ?? payload.employment_status ?? 'Active',
    monthly_salary: payload.monthlySalary ?? payload.monthly_salary ?? 0,
    notes: payload.notes ?? null,
    subjects_taught: payload.subjectsTaught ?? payload.subjects_taught ?? [],
  });

  if (!created) throw new Error('Failed to create teacher');
  return toPublic(created);
}

export async function updateTeacher(id: number, payload: any) {
  const updated = await repo.updateTeacher(id, {
    display_name: payload.fullName ?? payload.display_name ?? payload.full_name,
    email: payload.email,
    phone: payload.phoneNumber ?? payload.phone,
    gender: payload.gender,
    date_of_birth: payload.dateOfBirth ?? payload.date_of_birth,
    address: payload.address,
    employment_date: payload.employmentDate ?? payload.employment_date,
    employment_status: payload.employmentStatus ?? payload.employment_status,
    monthly_salary: payload.monthlySalary ?? payload.monthly_salary,
    notes: payload.notes,
    subjects_taught: payload.subjectsTaught ?? payload.subjects_taught,
    staff_id: payload.staffId ?? payload.staff_id,
  });
  if (!updated) throw new Error('Teacher not found');
  return toPublic(updated);
}

export async function deleteTeacher(id: number) {
  return repo.deleteTeacher(id);
}

export default { listTeachers, getTeacher, getNextStaffId, createTeacher, updateTeacher, deleteTeacher };
