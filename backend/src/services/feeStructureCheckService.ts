import { query } from '../db/connection.js';
import { resolveActiveLedgerTerm } from './studentUnifiedBalanceService.js';

export type MissingClass = { id: string; name: string };

export type FeeStructureCheckResult = {
  complete: boolean;
  total_classes: number;
  configured_classes: number;
  missing_classes: MissingClass[];
  term_id: number | null;
};

/**
 * Verifies every class in the school has a ledger fee structure for the given term.
 * When termId is omitted, resolves the active term from school settings / academic_terms.
 */
export async function checkFeeStructureCompleteness(
  tenantId: number,
  termId?: number | null
): Promise<FeeStructureCheckResult> {
  const { ledgerTermId, academicYearId } = await resolveActiveLedgerTerm(query, tenantId, termId ?? undefined);

  if (!ledgerTermId || !academicYearId) {
    return {
      complete: false,
      total_classes: 0,
      configured_classes: 0,
      missing_classes: [],
      term_id: null,
    };
  }

  const classesRes = await query(
    `SELECT id, class_name
     FROM classes
     WHERE tenant_id = $1
     ORDER BY class_name`,
    [tenantId]
  );

  const configuredRes = await query(
    `SELECT DISTINCT class_id
     FROM ledger_fee_structures
     WHERE tenant_id = $1
       AND academic_year_id = $2
       AND term_id = $3
       AND COALESCE(total, 0) >= 0`,
    [tenantId, academicYearId, ledgerTermId]
  );

  const configuredIds = new Set(configuredRes.rows.map((r) => Number(r.class_id)));
  const allClasses = classesRes.rows.map((r) => ({
    id: String(r.id),
    name: String(r.class_name || `Class ${r.id}`),
  }));

  const missing_classes = allClasses.filter((c) => !configuredIds.has(Number(c.id)));

  return {
    complete: allClasses.length > 0 && missing_classes.length === 0,
    total_classes: allClasses.length,
    configured_classes: allClasses.length - missing_classes.length,
    missing_classes,
    term_id: ledgerTermId,
  };
}
