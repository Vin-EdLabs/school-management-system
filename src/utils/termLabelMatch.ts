/** Normalize term labels for flexible matching (settings vs ledger formats). */

export function normalizeTermLabel(label: string): string {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function extractTermOnly(label: string): string {
  return (
    String(label || '')
      .replace(/\s+\d{4}(\s*\/\s*\d{4})?$/, '')
      .replace(/\s+\d{4}$/, '')
      .trim() || String(label || '').trim()
  );
}

export function buildActiveTermLabel(term: string, year?: string | null): string {
  const t = String(term || '').trim();
  const y = String(year || '').trim();
  if (!t || t === 'Not Set') return '';
  if (!y || t.includes(y)) return t;
  return `${t} ${y}`.trim();
}

export function buildTermLabelVariants(termRaw: string, yearRaw?: string | null): string[] {
  const labels = new Set<string>();
  const raw = String(termRaw || '').trim();
  const year = String(yearRaw || '').trim();
  if (!raw) return [];

  labels.add(normalizeTermLabel(raw));
  const termOnly = extractTermOnly(raw);
  labels.add(normalizeTermLabel(termOnly));

  if (year) {
    labels.add(normalizeTermLabel(`${termOnly} ${year}`));
    if (!raw.includes(year)) {
      labels.add(normalizeTermLabel(`${raw} ${year}`));
    }
  }

  const slashYear = raw.match(/\d{4}\s*\/\s*\d{4}/)?.[0];
  if (slashYear) {
    labels.add(normalizeTermLabel(raw));
    labels.add(normalizeTermLabel(`${termOnly} ${slashYear}`));
  }

  return [...labels].filter(Boolean);
}

export function termsMatch(a: string, b: string): boolean {
  const na = normalizeTermLabel(a);
  const nb = normalizeTermLabel(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.startsWith(nb) || nb.startsWith(na)) return true;
  const aOnly = normalizeTermLabel(extractTermOnly(a));
  const bOnly = normalizeTermLabel(extractTermOnly(b));
  return aOnly.length > 0 && aOnly === bOnly;
}

export function feeStructureMatchesActiveTerm(
  feeTerm: string | null | undefined,
  currentTerm: string,
  currentYear?: string | null
): boolean {
  const ft = String(feeTerm || '').trim();
  const activeFull = buildActiveTermLabel(currentTerm, currentYear);
  if (!ft) return true;
  if (!activeFull) return true;

  const activeVariants = buildTermLabelVariants(activeFull, currentYear);
  const feeVariants = buildTermLabelVariants(ft, currentYear);

  for (const a of activeVariants) {
    for (const f of feeVariants) {
      if (a === f || a.startsWith(f) || f.startsWith(a)) return true;
    }
  }

  return termsMatch(ft, activeFull) || termsMatch(ft, currentTerm);
}
