import { query } from '../db/connection.js';

export type LedgerTermRow = {
  id: number;
  tenant_id: number;
  academic_year_id: number;
  name: string;
  status: string;
  is_current: boolean;
  start_date: string | null;
  end_date: string | null;
  closed_at: string | null;
  year_label?: string;
};

/**
 * Term identity helpers — resolve by id and dates only.
 * Display `name` must never drive ordering or business decisions.
 */

export async function getActiveLedgerTerm(tenantId: number): Promise<LedgerTermRow | null> {
  const res = await query(
    `SELECT t.id, t.tenant_id, t.academic_year_id, t.name, t.status, t.is_current,
            t.start_date, t.end_date, t.closed_at,
            COALESCE(ay.label, ay.name) AS year_label
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.tenant_id = $1
       AND t.is_current = true
       AND COALESCE(t.status, 'active') NOT IN ('closed', 'closing')
       AND t.closed_at IS NULL
     ORDER BY t.start_date DESC NULLS LAST, t.id DESC
     LIMIT 1`,
    [tenantId]
  );
  if (res.rows.length) return res.rows[0] as LedgerTermRow;

  // Fallback: active academic_terms.ledger_term_id (id link only)
  const linked = await query(
    `SELECT t.id, t.tenant_id, t.academic_year_id, t.name, t.status, t.is_current,
            t.start_date, t.end_date, t.closed_at,
            COALESCE(ay.label, ay.name) AS year_label
     FROM academic_terms at
     JOIN terms t ON t.id = at.ledger_term_id AND t.tenant_id = at.tenant_id
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE at.tenant_id = $1
       AND at.is_active = true
       AND at.closed_at IS NULL
       AND at.ledger_term_id IS NOT NULL
       AND COALESCE(t.status, 'active') NOT IN ('closed', 'closing')
       AND t.closed_at IS NULL
     LIMIT 1`,
    [tenantId]
  );
  return (linked.rows[0] as LedgerTermRow) ?? null;
}

/** Previous closed term for arrears — ordered by end_date, never by name. */
export async function getPreviousClosedTerm(
  tenantId: number,
  currentTermStartDate: string | Date | null,
  currentTermId?: number | null
): Promise<LedgerTermRow | null> {
  if (currentTermStartDate) {
    const res = await query(
      `SELECT t.id, t.tenant_id, t.academic_year_id, t.name, t.status, t.is_current,
              t.start_date, t.end_date, t.closed_at,
              COALESCE(ay.label, ay.name) AS year_label
       FROM terms t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       WHERE t.tenant_id = $1
         AND t.status = 'closed'
         AND t.end_date IS NOT NULL
         AND t.end_date < $2::date
         AND ($3::int IS NULL OR t.id <> $3::int)
       ORDER BY t.end_date DESC, t.id DESC
       LIMIT 1`,
      [tenantId, currentTermStartDate, currentTermId ?? null]
    );
    if (res.rows.length) return res.rows[0] as LedgerTermRow;
  }

  // Fallback when dates missing: most recently closed by closed_at (still not by name)
  const res = await query(
    `SELECT t.id, t.tenant_id, t.academic_year_id, t.name, t.status, t.is_current,
            t.start_date, t.end_date, t.closed_at,
            COALESCE(ay.label, ay.name) AS year_label
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.tenant_id = $1
       AND t.status = 'closed'
       AND ($2::int IS NULL OR t.id <> $2::int)
     ORDER BY t.closed_at DESC NULLS LAST, t.id DESC
     LIMIT 1`,
    [tenantId, currentTermId ?? null]
  );
  return (res.rows[0] as LedgerTermRow) ?? null;
}

/** Next inactive/open term after current — ordered by start_date, never by name. */
export async function getNextInactiveTerm(
  tenantId: number,
  currentTermEndDate: string | Date | null,
  currentTermId?: number | null
): Promise<LedgerTermRow | null> {
  if (currentTermEndDate) {
    const res = await query(
      `SELECT t.id, t.tenant_id, t.academic_year_id, t.name, t.status, t.is_current,
              t.start_date, t.end_date, t.closed_at,
              COALESCE(ay.label, ay.name) AS year_label
       FROM terms t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       WHERE t.tenant_id = $1
         AND COALESCE(t.status, 'active') NOT IN ('closed', 'closing')
         AND t.closed_at IS NULL
         AND t.is_current = false
         AND t.start_date IS NOT NULL
         AND t.start_date > $2::date
         AND ($3::int IS NULL OR t.id <> $3::int)
       ORDER BY t.start_date ASC, t.id ASC
       LIMIT 1`,
      [tenantId, currentTermEndDate, currentTermId ?? null]
    );
    if (res.rows.length) return res.rows[0] as LedgerTermRow;
  }

  const res = await query(
    `SELECT t.id, t.tenant_id, t.academic_year_id, t.name, t.status, t.is_current,
            t.start_date, t.end_date, t.closed_at,
            COALESCE(ay.label, ay.name) AS year_label
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.tenant_id = $1
       AND COALESCE(t.status, 'active') NOT IN ('closed', 'closing')
       AND t.closed_at IS NULL
       AND t.is_current = false
       AND ($2::int IS NULL OR t.id <> $2::int)
     ORDER BY t.start_date ASC NULLS LAST, t.id ASC
     LIMIT 1`,
    [tenantId, currentTermId ?? null]
  );
  return (res.rows[0] as LedgerTermRow) ?? null;
}

/** True if [start,end] overlaps any non-closed term for the tenant (optional exclude id). */
export async function findOverlappingTerm(
  tenantId: number,
  startDate: string,
  endDate: string,
  excludeTermId?: number | null
): Promise<{ id: number; name: string; start_date: string; end_date: string } | null> {
  const res = await query(
    `SELECT id, name, start_date::text, end_date::text
     FROM terms
     WHERE tenant_id = $1
       AND COALESCE(status, 'active') != 'closed'
       AND closed_at IS NULL
       AND start_date IS NOT NULL
       AND end_date IS NOT NULL
       AND start_date < $3::date
       AND end_date > $2::date
       AND ($4::int IS NULL OR id <> $4::int)
     ORDER BY start_date ASC
     LIMIT 1`,
    [tenantId, startDate, endDate, excludeTermId ?? null]
  );
  return res.rows[0] ?? null;
}

/** Sync calendar dates onto a ledger term by id (never by name). */
export async function syncLedgerTermDates(
  tenantId: number,
  ledgerTermId: number,
  startDate: string | null,
  endDate: string | null
): Promise<void> {
  if (!startDate && !endDate) return;
  await query(
    `UPDATE terms
     SET start_date = COALESCE($3::date, start_date),
         end_date = COALESCE($4::date, end_date)
     WHERE id = $1 AND tenant_id = $2`,
    [ledgerTermId, tenantId, startDate, endDate]
  );
}
