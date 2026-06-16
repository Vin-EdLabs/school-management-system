/** Match backend academicReports inferTermBounds — used when term rows lack start/end dates. */
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
