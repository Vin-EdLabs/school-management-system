/** SQL fragment: only currently enrolled active students (counted in totals). */
export const ACTIVE_STUDENT_WHERE = "COALESCE(s.enrollment_status, 'active') = 'active'";

export const ACTIVE_STUDENT_JOIN = `AND ${ACTIVE_STUDENT_WHERE}`;

export function isActiveEnrollmentStatus(status: string | null | undefined): boolean {
  return (status || 'active').toLowerCase().trim() === 'active';
}

export function canReceiveFees(status: string | null | undefined): boolean {
  return isActiveEnrollmentStatus(status);
}
