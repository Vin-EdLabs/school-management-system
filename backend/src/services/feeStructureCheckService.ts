import { query } from '../db/connection.js';
import { resolveLedgerTermFromSettings } from './ledgerFinanceService.js';
import { ACTIVE_STUDENT_WHERE } from '../utils/studentEnrollment.js';

export type MissingClass = { id: string; name: string };

export type FeeStructureCheckResult = {
  complete: boolean;
  total_classes: number;
  configured_classes: number;
  missing_classes: MissingClass[];
  term_id: number | null;
};

type FeeCheckContext = {
  termLabels: string[];
  ledgerTermIds: number[];
  academicYearIds: number[];
  primaryTermId: number | null;
};

function normalizeClassName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Match fee_structures.term against active term labels (same rules as finance reports). */
function resolveTermMatch(term: string | null, academicYear: string | null): string | null {
  if (!term) return null;
  const t = String(term).trim();
  if (!academicYear) return t;
  const y = String(academicYear).trim();
  if (!y || t.endsWith(y)) return t;
  return `${t} ${y}`;
}

function termMatchSql(alias: string): string {
  const t = alias;
  return `(
    TRIM(COALESCE(${t}.term, '')) = ''
    OR ${t}.term = $2 OR ${t}.term = $4 OR ${t}.term LIKE $3
    OR $2 LIKE TRIM(${t}.term) || '%' OR TRIM(${t}.term) LIKE $2 || '%'
    OR $4 LIKE TRIM(${t}.term) || '%' OR TRIM(${t}.term) LIKE $4 || '%'
  )`;
}

function ledgerTermLabelSql(): string {
  return `TRIM(CONCAT(t.name, ' ', ay.name))`;
}

function addTermLabelVariants(labels: Set<string>, year: string, termRaw: string) {
  const raw = String(termRaw || '').trim();
  const y = String(year || '').trim();
  if (!raw) return;

  labels.add(raw);
  const yearInRaw = raw.match(/(19|20)\d{2}$/)?.[0];
  const termOnly = raw.replace(/\s+(19|20)\d{2}$/, '').trim() || raw;

  if (y) {
    labels.add(resolveTermMatch(termOnly, y) || `${termOnly} ${y}`.trim());
    labels.add(`${termOnly} ${y}`.trim());
    if (!yearInRaw) {
      labels.add(`${raw} ${y}`.trim());
    }
  }
  labels.add(termOnly);
}

/**
 * Resolve the same term context used when saving fees (school_settings first),
 * plus optional academic_terms hints. Collects every ledger term id / label variant.
 */
async function resolveFeeCheckContext(
  tenantId: number,
  options?: { academicTermId?: number | null; termHint?: string | null }
): Promise<FeeCheckContext> {
  const labels = new Set<string>();
  const ledgerTermIds = new Set<number>();
  const academicYearIds = new Set<number>();

  const settingsRes = await query(
    `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  const settingsTerm = String(settingsRes.rows[0]?.current_term || '').trim();
  const settingsYear = String(settingsRes.rows[0]?.current_year || '').trim();

  const register = async (year: string, termRaw: string) => {
    if (!year || !termRaw) return;
    addTermLabelVariants(labels, year, termRaw);
    const resolved = await resolveLedgerTermFromSettings(tenantId, year, termRaw);
    if (!resolved) return;
    ledgerTermIds.add(resolved.termId);
    academicYearIds.add(resolved.academicYearId);
  };

  // Primary: school settings — same source as POST /fees when saving fee structures.
  await register(settingsYear, settingsTerm);

  if (options?.termHint) {
    const hint = String(options.termHint).trim();
    const hintYear = hint.match(/(19|20)\d{2}$/)?.[0] || settingsYear;
    await register(hintYear, hint);
  }

  if (options?.academicTermId != null && !Number.isNaN(Number(options.academicTermId))) {
    const academicRes = await query(
      `SELECT term_name, year FROM academic_terms WHERE id = $1 AND tenant_id = $2`,
      [options.academicTermId, tenantId]
    );
    if (academicRes.rows.length > 0) {
      const row = academicRes.rows[0];
      await register(String(row.year), String(row.term_name));
    }
  }

  const primaryTermId = ledgerTermIds.size > 0 ? [...ledgerTermIds][0] : null;

  return {
    termLabels: [...labels].filter(Boolean),
    ledgerTermIds: [...ledgerTermIds],
    academicYearIds: [...academicYearIds],
    primaryTermId,
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

  if (ctx.ledgerTermIds.length > 0) {
    const byTerm = await query(
      `SELECT DISTINCT class_id
       FROM ledger_fee_structures
       WHERE tenant_id = $1
         AND term_id = ANY($2::int[])`,
      [tenantId, ctx.ledgerTermIds]
    );
    for (const row of byTerm.rows) {
      configured.add(Number(row.class_id));
    }
  }

  if (ctx.academicYearIds.length > 0 && ctx.ledgerTermIds.length > 0) {
    const exact = await query(
      `SELECT DISTINCT class_id
       FROM ledger_fee_structures
       WHERE tenant_id = $1
         AND academic_year_id = ANY($2::int[])
         AND term_id = ANY($3::int[])`,
      [tenantId, ctx.academicYearIds, ctx.ledgerTermIds]
    );
    for (const row of exact.rows) {
      configured.add(Number(row.class_id));
    }
  }

  const labelSql = ledgerTermLabelSql();
  for (const label of ctx.termLabels) {
    const termOnly = label.replace(/\s+(19|20)\d{2}$/, '').trim() || label;
    const termLike = `${label}%`;

    const byLabel = await query(
      `SELECT DISTINCT lfs.class_id
       FROM ledger_fee_structures lfs
       INNER JOIN terms t ON t.id = lfs.term_id AND t.tenant_id = lfs.tenant_id
       INNER JOIN academic_years ay ON ay.id = lfs.academic_year_id AND ay.tenant_id = lfs.tenant_id
       WHERE lfs.tenant_id = $1
         AND (
           ${labelSql} = $2
           OR TRIM(t.name) = $2
           OR TRIM(t.name) = $4
           OR ${labelSql} ILIKE $3
           OR $2 ILIKE TRIM(t.name) || '%'
           OR TRIM(t.name) ILIKE $2 || '%'
         )`,
      [tenantId, label, termLike, termOnly]
    );
    for (const row of byLabel.rows) {
      configured.add(Number(row.class_id));
    }

    const termMatch = resolveTermMatch(termOnly, label.match(/(19|20)\d{2}$/)?.[0] ?? null);
    const legacyLike = termMatch ? `${termMatch}%` : '%';
    const legacy = await query(
      `SELECT DISTINCT class_id
       FROM fee_structures fs
       WHERE fs.tenant_id = $1
         AND fs.class_id IS NOT NULL
         AND ${termMatchSql('fs')}`,
      [tenantId, termMatch, legacyLike, termOnly]
    );
    for (const row of legacy.rows) {
      configured.add(Number(row.class_id));
    }
  }

  // DB-direct classes: fee may be on a different class row with the same display name.
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
  options?: { academicTermId?: number | null; termHint?: string | null }
): Promise<FeeStructureCheckResult> {
  const ctx = await resolveFeeCheckContext(tenantId, options);

  if (ctx.ledgerTermIds.length === 0 || ctx.termLabels.length === 0) {
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
      term_id: ctx.primaryTermId,
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
    term_id: ctx.primaryTermId,
  };
}
