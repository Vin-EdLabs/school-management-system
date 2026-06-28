import { query } from '../db/connection.js';

export type ActiveTermYear = {
  term: string;
  academicYear: string;
};

export async function getSchoolActiveTermYear(tenantId: number): Promise<ActiveTermYear> {
  const res = await query(
    `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  return {
    term: String(res.rows[0]?.current_term || '').trim(),
    academicYear: String(res.rows[0]?.current_year || '').trim(),
  };
}

/** SQL fragment: `AND alias.term = $n AND alias.academic_year = $m` */
export function assignmentTermFilter(alias: string, termParam: string, yearParam: string): string {
  return `AND ${alias}.term = ${termParam} AND ${alias}.academic_year = ${yearParam}`;
}
