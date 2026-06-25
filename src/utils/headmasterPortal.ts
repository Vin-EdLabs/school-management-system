/** Headmaster portal helpers (frontend). */

import type { UserRole } from '@/contexts/AuthContext';

export const HEADMASTER_MODULES = [
  'headmaster-dashboard',
  'teacher-classes',
  'attendance',
  'grades',
  'teacher-quizzes',
  'teacher-profile',
  'teacher-appointment-letters',
  'teacher-payment-history',
  'students-view-only',
  'headmaster-all-classes',
  'headmaster-all-attendance',
  'headmaster-all-staff',
  'headmaster-grades',
  'print-fee-status',
  'push-notifications',
  'parent-desk',
  'calendar',
  'birthdays',
  'id-cards',
  'records',
  'settings',
  'settings-password-only',
] as const;

export function isHeadmasterRole(role?: UserRole | string | null): boolean {
  return role === 'headmaster';
}

export function headmasterHasTeachingAccess(user: { role?: string; teacherId?: string } | null): boolean {
  return isHeadmasterRole(user?.role) && !!user?.teacherId;
}
