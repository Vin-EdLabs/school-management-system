import { query } from '../db/connection.js';
import { resolveLedgerTermFromSettings } from './ledgerFinanceService.js';
import { isLedgerTermClosed } from './termCloseService.js';

function buildFullTermLabel(termName: string, year: string): string {
  const clean = String(termName || '').trim();
  const y = String(year || '').trim();
  if (!y) return clean;
  return clean.includes(y) ? clean : `${clean} ${y}`.trim();
}

export type ClosedTermRecord = {
  academicTermId: number;
  termName: string;
  year: string;
  termLabel: string;
  startDate: string | null;
  endDate: string | null;
  ledgerTermId: number | null;
  ledgerStatus: string | null;
  closedAt: string | null;
  isClosed: boolean;
  snapshot: {
    id: number;
    totalStudents: number;
    totalFeesBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    totalCredits: number;
    createdAt: string;
  } | null;
  feeArchive: {
    id: number;
    structureCount: number;
    structures: Array<{
      class_id: number;
      class_name: string;
      level: string | null;
      total: number;
      items: Array<{ item_name: string; amount: number; is_active: boolean }>;
    }>;
  } | null;
};

export async function getClosedAcademicTermRecord(
  tenantId: number,
  academicTermId: number
): Promise<ClosedTermRecord | null> {
  const termRes = await query(
    `SELECT id, term_name, year, start_date, end_date, is_active, closed_at, ledger_term_id
     FROM academic_terms
     WHERE tenant_id = $1 AND id = $2`,
    [tenantId, academicTermId]
  );
  if (termRes.rows.length === 0) return null;

  const row = termRes.rows[0];
  const termName = String(row.term_name || '').trim();
  const year = String(row.year || '').trim();
  const termLabel = buildFullTermLabel(termName, year);

  const resolved = await resolveLedgerTermFromSettings(tenantId, year, termLabel);
  const ledgerTermId = resolved?.termId ?? null;

  let ledgerStatus: string | null = null;
  let closedAt: string | null = null;
  let isClosed = false;

  if (ledgerTermId) {
    isClosed = await isLedgerTermClosed(tenantId, ledgerTermId);
    const ledgerRes = await query(
      `SELECT status, closed_at FROM terms WHERE id = $1 AND tenant_id = $2`,
      [ledgerTermId, tenantId]
    );
    ledgerStatus = ledgerRes.rows[0]?.status ? String(ledgerRes.rows[0].status) : null;
    closedAt = ledgerRes.rows[0]?.closed_at ? String(ledgerRes.rows[0].closed_at) : null;
    isClosed = isClosed || ledgerStatus === 'closed';
  }

  if (!isClosed && row.closed_at) {
    isClosed = true;
    closedAt = closedAt || String(row.closed_at);
  }

  let snapshot: ClosedTermRecord['snapshot'] = null;
  if (ledgerTermId) {
    const snapRes = await query(
      `SELECT id, total_students, total_fees_billed, total_collected,
              total_outstanding, total_credits, created_at
       FROM term_snapshots
       WHERE tenant_id = $1 AND term_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId, ledgerTermId]
    );
    if (snapRes.rows.length > 0) {
      const s = snapRes.rows[0];
      snapshot = {
        id: Number(s.id),
        totalStudents: Number(s.total_students) || 0,
        totalFeesBilled: Number(s.total_fees_billed) || 0,
        totalCollected: Number(s.total_collected) || 0,
        totalOutstanding: Number(s.total_outstanding) || 0,
        totalCredits: Number(s.total_credits) || 0,
        createdAt: String(s.created_at || ''),
      };
    }
  }

  let feeArchive: ClosedTermRecord['feeArchive'] = null;
  if (ledgerTermId) {
    const archRes = await query(
      `SELECT id, structure_count, structures
       FROM term_fee_structure_archives
       WHERE tenant_id = $1 AND ledger_term_id = $2
       LIMIT 1`,
      [tenantId, ledgerTermId]
    );
    if (archRes.rows.length > 0) {
      const a = archRes.rows[0];
      const structures = Array.isArray(a.structures)
        ? a.structures
        : JSON.parse(String(a.structures || '[]'));
      feeArchive = {
        id: Number(a.id),
        structureCount: Number(a.structure_count) || 0,
        structures: structures.map((c: Record<string, unknown>) => ({
          class_id: Number(c.class_id),
          class_name: String(c.class_name || ''),
          level: c.level != null ? String(c.level) : null,
          total: Number(c.total) || 0,
          items: Array.isArray(c.items)
            ? c.items.map((i: Record<string, unknown>) => ({
                item_name: String(i.item_name || ''),
                amount: Number(i.amount) || 0,
                is_active: Boolean(i.is_active),
              }))
            : [],
        })),
      };
    }
  }

  return {
    academicTermId,
    termName,
    year,
    termLabel,
    startDate: row.start_date ? String(row.start_date) : null,
    endDate: row.end_date ? String(row.end_date) : null,
    ledgerTermId,
    ledgerStatus,
    closedAt,
    isClosed,
    snapshot,
    feeArchive,
  };
}

/** Throws if academic term maps to a closed ledger term and activation was requested. */
export async function assertAcademicTermCanBeActivated(
  tenantId: number,
  academicTermId: number
): Promise<void> {
  const record = await getClosedAcademicTermRecord(tenantId, academicTermId);
  if (!record) {
    throw new Error('Academic term not found.');
  }
  if (record.isClosed) {
    throw new Error(
      `${record.termLabel} is permanently closed and cannot be set active again. Use View to browse read-only records.`
    );
  }
}
