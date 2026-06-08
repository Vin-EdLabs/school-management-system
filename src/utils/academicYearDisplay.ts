/**
 * Normalizes stored year keys to display as "YYYY/YYYY+1" (e.g. "2026" → "2026/2027").
 * If the value is already "2026/2027", returns it normalized.
 */
export function formatAcademicYearLabel(raw: string | null | undefined): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const slash = s.match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (slash) return `${slash[1]}/${slash[2]}`;
  const one = s.match(/^(\d{4})$/);
  if (one) {
    const y = parseInt(one[1], 10);
    return `${y}/${y + 1}`;
  }
  const lead = s.match(/^(\d{4})/);
  if (lead) {
    const y = parseInt(lead[1], 10);
    return `${y}/${y + 1}`;
  }
  return s;
}
