import { query } from '../db/connection.js';
import { resolveActiveLedgerTerm } from './studentUnifiedBalanceService.js';
import { ACTIVE_STUDENT_WHERE } from '../utils/studentEnrollment.js';

function normalizeClassName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export type MissingClass = { id: string; name: string };

export type FeeStructureCheckResult = {
  complete: boolean;
  total_classes: number;
  configured_classes: number;
  missing_classes: MissingClass[];
  term_id: number | null;
};

type FeeCheckContext = {
  ledgerTermId: number | null;
  academicYearId: number | null;
};

async function resolveFeeCheckContext(
  tenantId: number,
  options?: {
    academicTermId?: number | null;
    ledgerTermId?: number | null;
    termHint?: string | null;
  }
): Promise<FeeCheckContext> {
  void options?.termHint;

  if (options?.ledgerTermId != null && !Number.isNaN(Number(options.ledgerTermId))) {
    const rowRes = await query(
      `SELECT id, academic_year_id FROM terms WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [options.ledgerTermId, tenantId]
    );
    if (rowRes.rows.length > 0) {
      return {
        ledgerTermId: Number(rowRes.rows[0].id),
        academicYearId: Number(rowRes.rows[0].academic_year_id),
      };
    }
  }

  const active = await resolveActiveLedgerTerm(
    query,
    tenantId,
    options?.academicTermId ?? undefined
  );
  return {
    ledgerTermId: active.ledgerTermId,
    academicYearId: active.academicYearId,
  };
}

/**
 * Classes that need a fee structure: those with at least one active student.
 */
async function listClassesRequiringFeeStructures(
  tenantId: number
): Promise<Array<{ id: number; name: string; nameKey: string }>> {
  const mapRow = (r: { id: unknown; class_name: unknown }) => {
    const name = String(r.class_name);
    return { id: Number(r.id), name, nameKey: normalizeClassName(name) };
  };

  try {
    const withEnrollments = await query(
      `SELECT DISTINCT c.id,
              COALESCE(NULLIF(TRIM(c.class_name), ''), NULLIF(TRIM(c.name), ''), 'Class ' || c.id) AS class_name
       FROM classes c
       WHERE c.tenant_id = $1
         AND (
           EXISTS (
             SELECT 1 FROM students s
             WHERE s.tenant_id = c.tenant_id
               AND s.class_assigned_id = c.id
               AND ${ACTIVE_STUDENT_WHERE}
           )
           OR EXISTS (
             SELECT 1 FROM student_class_enrollments e
             WHERE e.tenant_id = c.tenant_id
               AND e.class_id = c.id
               AND e.status IN ('active', 'repeat')
           )
         )
       ORDER BY class_name`,
      [tenantId]
    );
    if (withEnrollments.rows.length > 0) {
      return withEnrollments.rows.map(mapRow);
    }
  } catch {
    /* fall through */
  }

  try {
    const rosterOnly = await query(
      `SELECT DISTINCT c.id,
              COALESCE(NULLIF(TRIM(c.class_name), ''), NULLIF(TRIM(c.name), ''), 'Class ' || c.id) AS class_name
       FROM classes c
       INNER JOIN students s ON s.tenant_id = c.tenant_id AND s.class_assigned_id = c.id
       WHERE c.tenant_id = $1
         AND ${ACTIVE_STUDENT_WHERE}
       ORDER BY class_name`,
      [tenantId]
    );
    return rosterOnly.rows.map(mapRow);
  } catch {
    return [];
  }
}

async function listDailyFeeConfiguredClassIds(tenantId: number): Promise<Set<number>> {
  const res = await query(
    `SELECT DISTINCT dfs.class_id
     FROM daily_fee_structures dfs
     INNER JOIN classes c ON c.id = dfs.class_id AND c.tenant_id = dfs.tenant_id
     WHERE dfs.tenant_id = $1
       AND COALESCE(c.fee_mode, 'term') = 'daily'`,
    [tenantId]
  );
  return new Set(res.rows.map((r) => Number(r.class_id)));
}

async function listDailyFeeClassIds(tenantId: number): Promise<Set<number>> {
  const res = await query(
    `SELECT id FROM classes WHERE tenant_id = $1 AND COALESCE(fee_mode, 'term') = 'daily'`,
    [tenantId]
  );
  return new Set(res.rows.map((r) => Number(r.id)));
}

async function listConfiguredClassIds(
  tenantId: number,
  ctx: FeeCheckContext
): Promise<Set<number>> {
  const configured = new Set<number>();
  if (ctx.ledgerTermId == null) return configured;

  const byTerm = await query(
    `SELECT DISTINCT class_id
     FROM ledger_fee_structures
     WHERE tenant_id = $1 AND term_id = $2`,
    [tenantId, ctx.ledgerTermId]
  );
  for (const row of byTerm.rows) {
    configured.add(Number(row.class_id));
  }

  if (configured.size > 0) {
    const feeClassIds = [...configured];
    const aliasRes = await query(
      `SELECT DISTINCT c_student.id AS class_id
       FROM classes c_student
       INNER JOIN classes c_fee
         ON c_fee.tenant_id = c_student.tenant_id
        AND LOWER(TRIM(COALESCE(c_fee.class_name, '')))
          = LOWER(TRIM(COALESCE(c_student.class_name, '')))
       WHERE c_student.tenant_id = $1
         AND c_fee.id = ANY($2::int[])
         AND TRIM(COALESCE(c_student.class_name, '')) <> ''`,
      [tenantId, feeClassIds]
    );
    for (const row of aliasRes.rows) {
      configured.add(Number(row.class_id));
    }
  }

  return configured;
}

/**
 * Verifies every in-use class has a fee structure for the active term.
 * Uses school_settings (same as fee save) and flexible term/class matching.
 */
export async function checkFeeStructureCompleteness(
  tenantId: number,
  options?: {
    academicTermId?: number | null;
    ledgerTermId?: number | null;
    termHint?: string | null;
  }
): Promise<FeeStructureCheckResult> {
  const ctx = await resolveFeeCheckContext(tenantId, options);

  if (ctx.ledgerTermId == null) {
    return {
      complete: false,
      total_classes: 0,
      configured_classes: 0,
      missing_classes: [],
      term_id: null,
    };
  }

  const classesRequiringFees = await listClassesRequiringFeeStructures(tenantId);
  const dailyClassIds = await listDailyFeeClassIds(tenantId);
  const termFeeClassesOnly = classesRequiringFees.filter((c) => !dailyClassIds.has(c.id));
  const dailyClassesRequiring = classesRequiringFees.filter((c) => dailyClassIds.has(c.id));

  if (classesRequiringFees.length === 0) {
    return {
      complete: true,
      total_classes: 0,
      configured_classes: 0,
      missing_classes: [],
      term_id: ctx.ledgerTermId,
    };
  }

  const configuredIds = await listConfiguredClassIds(tenantId, ctx);
  const dailyConfigured = await listDailyFeeConfiguredClassIds(tenantId);

  const missingTerm = termFeeClassesOnly
    .filter((c) => !configuredIds.has(c.id))
    .map((c) => ({ id: String(c.id), name: c.name }));

  const missingDaily = dailyClassesRequiring
    .filter((c) => !dailyConfigured.has(c.id))
    .map((c) => ({ id: String(c.id), name: c.name }));

  const missing_classes = [...missingTerm, ...missingDaily];

  const total_classes = termFeeClassesOnly.length + dailyClassesRequiring.length;

  return {
    complete: missing_classes.length === 0,
    total_classes,
    configured_classes: total_classes - missing_classes.length,
    missing_classes,
    term_id: ctx.ledgerTermId,
  };
}
