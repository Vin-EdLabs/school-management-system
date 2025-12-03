import * as repo from '../repositories/teachers.repository.js';
import bcrypt from 'bcrypt';
import * as userRepo from '../repositories/user.repository.js';

export async function listTeachers() {
  const rows = await repo.listTeachers();
  // merge meta into top-level shape for frontend compatibility
  return rows.map((r: any) => ({ id: r.id, username: r.username, role: r.role, created_at: r.created_at, ...(r.meta ?? {}) }));
}

export async function getTeacher(id: number) {
  const r = await repo.findTeacherById(id);
  if (!r) return null;
  return { id: r.id, username: r.username, role: r.role, created_at: r.created_at, ...(r.meta ?? {}) };
}

export async function createTeacher(payload: any) {
  // Build profile meta from payload and create user via user repository
  const password = payload.password ?? '';
  const hash = await bcrypt.hash(password, 10);
  const meta = {
    fullName: payload.fullName ?? payload.full_name ?? '',
    gender: payload.gender ?? '',
    dateOfBirth: payload.dateOfBirth ?? payload.date_of_birth ?? null,
    phoneNumber: payload.phoneNumber ?? payload.phone_number ?? '',
    email: payload.email ?? '',
    address: payload.address ?? '',
    subjectsTaught: payload.subjectsTaught ?? payload.subjects_taught ?? [],
    classAssigned: payload.classAssigned ?? payload.class_assigned ?? null,
    employmentDate: payload.employmentDate ?? payload.employment_date ?? null,
    monthlySalary: payload.monthlySalary ?? payload.monthly_salary ?? 0,
    employmentStatus: payload.employmentStatus ?? payload.employment_status ?? 'Active',
    notes: payload.notes ?? ''
  };
  const created = await userRepo.createUser(payload.username, hash, 'teacher', meta);
  // return merged object to match frontend expectations
  return { id: created.id, username: created.username, role: created.role, created_at: created.created_at, ...meta };
}

export async function updateTeacher(id: number, payload: any) {
  return repo.updateTeacher(id, payload);
}

export async function deleteTeacher(id: number) {
  return repo.deleteTeacher(id);
}

export default { listTeachers, getTeacher, createTeacher, updateTeacher, deleteTeacher };
