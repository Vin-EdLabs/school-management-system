/** Shared role helpers for ScholarNerve staff portals. */

export const STAFF_ROLES = [
  'super-admin',
  'administrator',
  'finance',
  'teacher',
  'staff',
  'driver',
  'headmaster',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isTeachingStaffRole(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'teacher' || r === 'staff' || r === 'headmaster';
}

export function canAccessTeacherPortalRoutes(role: string | null | undefined, teacherId?: string | null): boolean {
  const r = String(role || '').toLowerCase();
  if (r === 'teacher' || r === 'staff') return !!teacherId;
  if (r === 'headmaster') return !!teacherId;
  return false;
}

export function canManageSchoolCalendar(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'super-admin' || r === 'administrator' || r === 'headmaster';
}

export function canBroadcastStaffAnnouncements(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'super-admin' || r === 'administrator' || r === 'finance' || r === 'headmaster';
}
