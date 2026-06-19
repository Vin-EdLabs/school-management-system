/** Normalize academic year for ID cards — e.g. "2026 / 2027" with no stray characters. */
export function formatIdCardAcademicYear(raw: string | number | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) {
    const y = new Date().getFullYear();
    return `${y} / ${y + 1}`;
  }

  const cleaned = s.replace(/[^\d\s/\-–]/g, '').replace(/\s+/g, ' ').trim();
  const slash = cleaned.match(/^(\d{4})\s*[\/\-–]\s*(\d{4})$/);
  if (slash) return `${slash[1]} / ${slash[2]}`;

  const single = cleaned.match(/^(\d{4})$/);
  if (single) {
    const y = parseInt(single[1], 10);
    return `${y} / ${y + 1}`;
  }

  const lead = cleaned.match(/^(\d{4})/);
  if (lead) {
    const y = parseInt(lead[1], 10);
    const tail = cleaned.match(/[\/\-–]\s*(\d{4})/);
    const y2 = tail ? parseInt(tail[1], 10) : y + 1;
    return `${y} / ${y2}`;
  }

  const y = new Date().getFullYear();
  return `${y} / ${y + 1}`;
}
