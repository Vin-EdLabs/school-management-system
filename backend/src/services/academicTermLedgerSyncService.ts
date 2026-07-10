import { query } from '../db/connection.js';

type QueryFn = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
};

function extractTermOnly(label: string): string {
  return (
    String(label || '')
      .replace(/\s+\d{4}(\s*\/\s*\d{4})?$/, '')
      .replace(/\s+\d{4}$/, '')
      .trim() || String(label || '').trim()
  );
}

function normalizeKey(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

async function resolveAcademicYearId(tenantId: number, yearRaw: string): Promise<number | null> {
  const year = String(yearRaw || '').trim();
  if (!year) return null;
  const res = await query(
    `SELECT id FROM academic_years
     WHERE tenant_id = $1
       AND (
         TRIM(name) = $2
         OR TRIM(REPLACE(name, ' ', '')) = TRIM(REPLACE($2, ' ', ''))
         OR name LIKE '%' || SPLIT_PART($2, '/', 1) || '%'
       )
     ORDER BY id DESC
     LIMIT 1`,
    [tenantId, year]
  );
  return res.rows[0]?.id != null ? Number(res.rows[0].id) : null;
}

/** Ensure the active academic term points at the correct open ledger term (name + year). */
export async function repairActiveAcademicTermLedgerLink(tenantId: number): Promise<{
  repaired: boolean;
  activeLedgerTermId: number | null;
  previousLedgerTermId: number | null;
}> {
  const activeRes = await query(
    `SELECT id, term_name, year, ledger_term_id
     FROM academic_terms
     WHERE tenant_id = $1 AND is_active = true AND closed_at IS NULL
     LIMIT 1`,
    [tenantId]
  );
  if (!activeRes.rows.length) {
    return { repaired: false, activeLedgerTermId: null, previousLedgerTermId: null };
  }

  const active = activeRes.rows[0];
  const previousLedgerTermId =
    active.ledger_term_id != null ? Number(active.ledger_term_id) : null;
  const termOnly = extractTermOnly(String(active.term_name || ''));
  const academicYearId = await resolveAcademicYearId(tenantId, String(active.year || ''));
  if (!academicYearId || !termOnly) {
    return { repaired: false, activeLedgerTermId: previousLedgerTermId, previousLedgerTermId };
  }

  const openRes = await query(
    `SELECT t.id, t.name, ay.name AS year_name
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.tenant_id = $1
       AND t.academic_year_id = $2
       AND LOWER(TRIM(t.name)) = LOWER(TRIM($3))
       AND t.closed_at IS NULL
       AND COALESCE(t.status, 'active') NOT IN ('closed', 'closing')
     ORDER BY t.is_current DESC, t.id DESC
     LIMIT 1`,
    [tenantId, academicYearId, termOnly]
  );

  let correctLedgerId: number | null =
    openRes.rows[0]?.id != null ? Number(openRes.rows[0].id) : null;

  if (!correctLedgerId) {
    const ins = await query(
      `INSERT INTO terms (tenant_id, academic_year_id, name, is_current, status)
       VALUES ($1, $2, $3, false, 'active')
       RETURNING id`,
      [tenantId, academicYearId, termOnly]
    );
    correctLedgerId = Number(ins.rows[0].id);
  }

  const fullLabel =
    String(active.year || '').trim() &&
    !String(active.term_name || '').includes(String(active.year))
      ? `${String(active.term_name).trim()} ${String(active.year).trim()}`.trim()
      : String(active.term_name || '').trim();

  let repaired = false;

  if (previousLedgerTermId !== correctLedgerId) {
    await query(
      `UPDATE academic_terms
       SET ledger_term_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3`,
      [correctLedgerId, active.id, tenantId]
    );
    repaired = true;
  }

  await query(
    `UPDATE terms
     SET status = 'closed', is_current = false
     WHERE tenant_id = $1
       AND closed_at IS NOT NULL
       AND id <> $2`,
    [tenantId, correctLedgerId]
  );

  await query(`UPDATE terms SET is_current = false WHERE tenant_id = $1`, [tenantId]);
  await query(
    `UPDATE terms
     SET is_current = true, status = 'active', closed_at = NULL
     WHERE id = $1 AND tenant_id = $2`,
    [correctLedgerId, tenantId]
  );

  await query(
    `UPDATE school_settings
     SET current_term = $1, current_year = $2, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $3`,
    [fullLabel, String(active.year || '').trim(), tenantId]
  );

  return {
    repaired: repaired || previousLedgerTermId !== correctLedgerId,
    activeLedgerTermId: correctLedgerId,
    previousLedgerTermId,
  };
}

/**
 * Resolve the ledger term for a specific academic term (by id), validating name+year match.
 * Updates academic_terms.ledger_term_id when a better open match is found.
 */
export async function resolveLedgerTermForAcademicTerm(
  tenantId: number,
  academicTermId: number,
  options?: { requireOpen?: boolean }
): Promise<number | null> {
  const requireOpen = options?.requireOpen ?? true;

  const atRes = await query(
    `SELECT id, term_name, year, ledger_term_id, is_active
     FROM academic_terms
     WHERE id = $1 AND tenant_id = $2`,
    [academicTermId, tenantId]
  );
  if (!atRes.rows.length) return null;

  const at = atRes.rows[0];
  const termOnly = extractTermOnly(String(at.term_name || ''));
  const academicYearId = await resolveAcademicYearId(tenantId, String(at.year || ''));
  if (!academicYearId || !termOnly) {
    return at.ledger_term_id != null ? Number(at.ledger_term_id) : null;
  }

  const openFilter = requireOpen
    ? `AND t.closed_at IS NULL AND COALESCE(t.status, 'active') NOT IN ('closed', 'closing')`
    : '';

  if (at.ledger_term_id != null) {
    const linkRes = await query(
      `SELECT t.id, t.closed_at, t.status
       FROM terms t
       WHERE t.id = $1
         AND t.tenant_id = $2
         AND t.academic_year_id = $3
         AND LOWER(TRIM(t.name)) = LOWER(TRIM($4))
         ${openFilter}`,
      [at.ledger_term_id, tenantId, academicYearId, termOnly]
    );
    if (linkRes.rows.length) {
      return Number(linkRes.rows[0].id);
    }
  }

  const matchRes = await query(
    `SELECT t.id
     FROM terms t
     WHERE t.tenant_id = $1
       AND t.academic_year_id = $2
       AND LOWER(TRIM(t.name)) = LOWER(TRIM($3))
       ${openFilter}
     ORDER BY t.is_current DESC, t.id DESC
     LIMIT 1`,
    [tenantId, academicYearId, termOnly]
  );
  const matchedId = matchRes.rows[0]?.id != null ? Number(matchRes.rows[0].id) : null;

  if (matchedId != null && Number(at.ledger_term_id) !== matchedId && at.is_active) {
    await query(
      `UPDATE academic_terms
       SET ledger_term_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3`,
      [matchedId, academicTermId, tenantId]
    );
  }

  return matchedId;
}

/** Match academic_terms rows to a ledger term by id and/or name+year. */
export async function markAcademicTermsClosedForLedger(
  run: QueryFn,
  tenantId: number,
  ledgerTermId: number,
  _termName: string,
  _academicYear: string
): Promise<number> {
  // Identity is ledger_term_id only — never close by display name.
  const result = await run.query(
    `UPDATE academic_terms at
     SET is_active = false,
         closed_at = COALESCE(at.closed_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE at.tenant_id = $1
       AND at.ledger_term_id = $2
       AND at.closed_at IS NULL
     RETURNING at.id`,
    [tenantId, ledgerTermId]
  );
  return result.rowCount ?? 0;
}

/** Backfill academic_terms.closed_at from closed ledger terms (e.g. after super-admin force close).
 * Only closes rows explicitly linked via ledger_term_id — never by fuzzy name match
 * (that was marking newly created terms closed when an old closed ledger shared the name).
 */
export async function repairAcademicTermsFromClosedLedgers(tenantId: number): Promise<number> {
  const result = await query(
    `UPDATE academic_terms at
     SET is_active = false,
         closed_at = COALESCE(at.closed_at, t.closed_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     FROM terms t
     WHERE at.tenant_id = $1
       AND t.tenant_id = at.tenant_id
       AND at.ledger_term_id = t.id
       AND t.status = 'closed'
       AND at.closed_at IS NULL
     RETURNING at.id`,
    [tenantId]
  );
  return result.rowCount ?? 0;
}

const SQL_RESOLVE_LEDGER_FOR_ACADEMIC = `
  CASE
    WHEN at.closed_at IS NOT NULL THEN at.ledger_term_id
    ELSE COALESCE(
      (
        SELECT t.id
        FROM terms t
        WHERE t.id = at.ledger_term_id
          AND t.tenant_id = at.tenant_id
          AND t.closed_at IS NULL
          AND COALESCE(t.status, 'active') NOT IN ('closed', 'closing')
      ),
      (
        SELECT t.id
        FROM terms t
        JOIN academic_years ay ON ay.id = t.academic_year_id
        WHERE t.tenant_id = at.tenant_id
          AND LOWER(TRIM(t.name)) = LOWER(TRIM(
            REGEXP_REPLACE(TRIM(COALESCE(at.term_name, '')), '\\s+\\d{4}(\\s*/\\s*\\d{4})?$', '')
          ))
          AND TRIM(REPLACE(COALESCE(at.year, ''), ' ', '')) = TRIM(REPLACE(ay.name, ' ', ''))
          AND t.closed_at IS NULL
          AND COALESCE(t.status, 'active') NOT IN ('closed', 'closing')
        ORDER BY t.is_current DESC, t.id DESC
        LIMIT 1
      )
    )
  END
`;

/** Relink open academic terms that still point at a closed ledger to a fresh open ledger. */
async function repairOpenAcademicTermsPointingAtClosedLedgers(tenantId: number): Promise<void> {
  const broken = await query(
    `SELECT at.id, at.term_name, at.year, at.ledger_term_id
     FROM academic_terms at
     JOIN terms t ON t.id = at.ledger_term_id AND t.tenant_id = at.tenant_id
     WHERE at.tenant_id = $1
       AND at.closed_at IS NULL
       AND (t.status = 'closed' OR t.closed_at IS NOT NULL)`,
    [tenantId]
  );

  for (const row of broken.rows) {
    const academicTermId = Number(row.id);
    const year = String(row.year || '').trim();
    const termName = String(row.term_name || '').trim();
    if (!year || !termName) continue;

    const { resolveLedgerTermFromSettings } = await import('./ledgerFinanceService.js');
    const fullLabel =
      year && !termName.includes(year) ? `${termName} ${year}`.trim() : termName;
    const resolved = await resolveLedgerTermFromSettings(tenantId, year, fullLabel);
    if (!resolved?.termId || resolved.termId === Number(row.ledger_term_id)) continue;

    await query(
      `UPDATE academic_terms
       SET ledger_term_id = $1, closed_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3 AND closed_at IS NULL`,
      [resolved.termId, academicTermId, tenantId]
    );
  }
}

export async function getAcademicTermsWithLedgerStatus(
  tenantId: number,
  includeArchived: boolean
): Promise<Record<string, unknown>[]> {
  await repairAcademicTermsFromClosedLedgers(tenantId);
  await repairOpenAcademicTermsPointingAtClosedLedgers(tenantId);
  await repairActiveAcademicTermLedgerLink(tenantId);

  const result = await query(
    includeArchived
      ? `SELECT at.*,
                lt.status AS ledger_status,
                lt.closed_at AS ledger_closed_at,
                ${SQL_RESOLVE_LEDGER_FOR_ACADEMIC} AS resolved_ledger_term_id
         FROM academic_terms at
         LEFT JOIN terms lt
           ON lt.tenant_id = at.tenant_id
          AND lt.id = ${SQL_RESOLVE_LEDGER_FOR_ACADEMIC}
         WHERE at.tenant_id = $1
         ORDER BY at.start_date ASC NULLS LAST, at.id ASC`
      : `SELECT at.*,
                lt.status AS ledger_status,
                lt.closed_at AS ledger_closed_at,
                ${SQL_RESOLVE_LEDGER_FOR_ACADEMIC} AS resolved_ledger_term_id
         FROM academic_terms at
         LEFT JOIN terms lt
           ON lt.tenant_id = at.tenant_id
          AND lt.id = ${SQL_RESOLVE_LEDGER_FOR_ACADEMIC}
         WHERE at.tenant_id = $1
           AND (COALESCE(at.is_archived, false) = false OR at.is_active = true)
         ORDER BY at.start_date ASC NULLS LAST, at.id ASC`,
    [tenantId]
  );

  return result.rows as Record<string, unknown>[];
}
