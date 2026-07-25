import { query } from '../db/connection.js';

export type ActiveTermYear = {
  term: string;
  academicYear: string;
  /** Full label as stored in school_settings (e.g. "Term 1 2024/2025"). */
  fullTermLabel: string;
};

/** Strip embedded academic year from combined term labels used in school_settings. */
export function normalizeTermOnly(currentTerm: string, academicYear: string): string {
  let term = String(currentTerm || '').trim();
  const year = String(academicYear || '').trim();
  if (!term) return '';
  if (year && term.includes(year)) {
    term = term.replace(year, '').trim();
  }
  return term;
}

export function buildFullTermLabel(termName: string, academicYear: string): string {
  const termOnly = normalizeTermOnly(termName, academicYear);
  const year = String(academicYear || '').trim();
  if (!year) return termOnly;
  if (termOnly.includes(year)) return termOnly;
  return `${termOnly} ${year}`.trim();
}

export async function getSchoolActiveTermYear(tenantId: number): Promise<ActiveTermYear> {
  const res = await query(
    `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const rawTerm = String(res.rows[0]?.current_term || '').trim();
  const academicYear = String(res.rows[0]?.current_year || '').trim();
  const term = normalizeTermOnly(rawTerm, academicYear) || rawTerm;
  return {
    term,
    academicYear,
    fullTermLabel: buildFullTermLabel(term, academicYear),
  };
}

/** Match grade rows stored with term-only or full combined labels. */
export function assignmentTermWhereClause(alias: string, termParam: string, yearParam: string, fullTermParam: string): string {
  return `AND ${alias}.academic_year = ${yearParam} AND (${alias}.term = ${termParam} OR ${alias}.term = ${fullTermParam})`;
}

/** Match term_report_releases / report_card_archive rows stored with either label format. */
export function releaseTermWhereClause(alias: string, termParam: string, fullTermParam: string): string {
  return `AND (${alias}.term = ${termParam} OR ${alias}.term = ${fullTermParam})`;
}

/** @deprecated Use assignmentTermWhereClause for flexible term matching */
export function assignmentTermFilter(alias: string, termParam: string, yearParam: string): string {
  return `AND ${alias}.term = ${termParam} AND ${alias}.academic_year = ${yearParam}`;
}

