/** Shared admission / inactivation term filters (registry + academic reports). */

export function inferTermBounds(termName: string, yearKey: string): { start: string; end: string } {
  const y = parseInt(String(yearKey).replace(/\D/g, '').slice(0, 4), 10) || new Date().getFullYear();
  const t = String(termName || '').toLowerCase();
  if (t.includes('1')) return { start: `${y}-09-01`, end: `${y}-12-31` };
  if (t.includes('2')) return { start: `${y + 1}-01-01`, end: `${y + 1}-04-30` };
  if (t.includes('3')) return { start: `${y + 1}-05-01`, end: `${y + 1}-08-31` };
  return { start: `${y}-09-01`, end: `${y + 1}-08-31` };
}

export function normalizeDateOnly(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.split('T')[0];
}

export const LEAVERS_TERM_WHERE = `(
  LOWER(COALESCE(enrollment_status, 'active')) IN ('inactive', 'withdrawn')
  AND (
    ($4::int IS NOT NULL AND inactivated_academic_term_id = $4::int)
    OR (
      COALESCE(inactivated_at, updated_at)::date >= $2::date
      AND COALESCE(inactivated_at, updated_at)::date <= $3::date
    )
  )
)`;

export const LEAVERS_TERM_WHERE_S = LEAVERS_TERM_WHERE
  .replace(/inactivated_academic_term_id/g, 's.inactivated_academic_term_id')
  .replace(/inactivated_at/g, 's.inactivated_at')
  .replace(/updated_at/g, 's.updated_at')
  .replace(/enrollment_status/g, 's.enrollment_status');

export const INACTIVE_ENROLLMENT_WHERE_S = `LOWER(COALESCE(s.enrollment_status, 'active')) IN ('inactive', 'withdrawn')`;
