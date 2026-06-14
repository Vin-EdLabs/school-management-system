import type { Teacher } from '@/contexts/DataContext';

/** Teachers eligible for class assignment — matches View All Teachers "active" filter. */
export function isAssignableTeacher(teacher: Teacher): boolean {
  const lifecycle = (teacher.status || 'active').toLowerCase();
  if (lifecycle === 'suspended' || lifecycle === 'deactivated') return false;

  const employment = (teacher.employmentStatus || '').trim().toLowerCase();
  if (employment === 'suspended' || employment === 'deactivated') return false;

  return !!teacher.fullName?.trim();
}

export function sortTeachersByName(a: Teacher, b: Teacher): number {
  return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
}
