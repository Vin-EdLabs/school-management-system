/** SQL fragment: only currently enrolled active students (counted in totals). Excludes soft-deleted students immediately — a super admin later purging or restoring the record doesn't change this. */
export const ACTIVE_STUDENT_WHERE =
  "COALESCE(s.enrollment_status, 'active') = 'active' AND COALESCE(s.is_deleted, false) = false";

export const ACTIVE_STUDENT_JOIN = `AND ${ACTIVE_STUDENT_WHERE}`;

export function isActiveEnrollmentStatus(status: string | null | undefined): boolean {
  return (status || 'active').toLowerCase().trim() === 'active';
}

export function canReceiveFees(status: string | null | undefined): boolean {
  return isActiveEnrollmentStatus(status);
}
