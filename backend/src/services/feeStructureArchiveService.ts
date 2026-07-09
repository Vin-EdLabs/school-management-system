import type pg from 'pg';
import { query, getClient } from '../db/connection.js';
import { executePostFeesForNewTerm, postFeesForClass } from './ledgerFinanceService.js';
import { checkFeeStructureCompleteness } from './feeStructureCheckService.js';

export type ArchivedFeeStructureItem = {
  item_name: string;
  amount: number;
  is_active: boolean;
  sort_order: number;
};

export type ArchivedFeeStructureClass = {
  class_id: number;
  class_name: string;
  level: string | null;
  total: number;
  tuition_fee: number;
  pta_fee: number;
  exam_fee: number;
  items: ArchivedFeeStructureItem[];
};

export type FeeStructureArchiveRow = {
  id: number;
  tenant_id: number;
  ledger_term_id: number;
  term_label: string;
  academic_year: string | null;
  structure_count: number;
  term_snapshot_id: number | null;
  created_at: string;
  structures?: ArchivedFeeStructureClass[];
};

function mapArchiveRow(row: Record<string, unknown>, includeStructures = false): FeeStructureArchiveRow {
  const base: FeeStructureArchiveRow = {
    id: Number(row.id),
    tenant_id: Number(row.tenant_id),
    ledger_term_id: Number(row.ledger_term_id),
    term_label: String(row.term_label || ''),
    academic_year: row.academic_year != null ? String(row.academic_year) : null,
    structure_count: Number(row.structure_count) || 0,
    term_snapshot_id: row.term_snapshot_id != null ? Number(row.term_snapshot_id) : null,
    created_at: String(row.created_at || ''),
  };
  if (includeStructures && row.structures != null) {
    const raw = row.structures;
    base.structures = (Array.isArray(raw) ? raw : JSON.parse(String(raw))) as ArchivedFeeStructureClass[];
  }
  return base;
}

/** Snapshot closing-term fee structures into archive (no billing). */
export async function archiveFeeStructuresForClosingTerm(
  client: pg.PoolClient,
  tenantId: number,
  ledgerTermId: number,
  termLabel: string,
  academicYear: string,
  termSnapshotId: number | null,
  createdByUserId: number | null
): Promise<FeeStructureArchiveRow | null> {
  const structuresRes = await client.query(
    `SELECT
       lfs.class_id,
       COALESCE(NULLIF(TRIM(c.class_name), ''), NULLIF(TRIM(c.name), ''), 'Class ' || c.id) AS class_name,
       c.level,
       lfs.total,
       lfs.tuition_fee,
       lfs.pta_fee,
       lfs.exam_fee,
       lfs.id AS fee_structure_id
     FROM ledger_fee_structures lfs
     INNER JOIN classes c ON c.id = lfs.class_id AND c.tenant_id = lfs.tenant_id
     WHERE lfs.tenant_id = $1
       AND lfs.term_id = $2
       AND COALESCE(c.fee_mode, 'term') <> 'daily'
     ORDER BY class_name ASC`,
    [tenantId, ledgerTermId]
  );

  if (structuresRes.rows.length === 0) {
    return null;
  }

  const structures: ArchivedFeeStructureClass[] = [];

  for (const row of structuresRes.rows) {
    const feeStructureId = Number(row.fee_structure_id);
    const itemsRes = await client.query(
      `SELECT item_name, amount, is_active, sort_order
       FROM fee_structure_items
       WHERE tenant_id = $1 AND fee_structure_id = $2
       ORDER BY sort_order ASC, id ASC`,
      [tenantId, feeStructureId]
    );

    const items: ArchivedFeeStructureItem[] =
      itemsRes.rows.length > 0
        ? itemsRes.rows.map((item) => ({
            item_name: String(item.item_name),
            amount: Number(item.amount) || 0,
            is_active: Boolean(item.is_active),
            sort_order: Number(item.sort_order) || 0,
          }))
        : [
            {
              item_name: 'Tuition',
              amount: Number(row.total) || 0,
              is_active: true,
              sort_order: 1,
            },
          ];

    structures.push({
      class_id: Number(row.class_id),
      class_name: String(row.class_name),
      level: row.level != null ? String(row.level) : null,
      total: Number(row.total) || 0,
      tuition_fee: Number(row.tuition_fee) || 0,
      pta_fee: Number(row.pta_fee) || 0,
      exam_fee: Number(row.exam_fee) || 0,
      items,
    });
  }

  const insert = await client.query(
    `INSERT INTO term_fee_structure_archives (
       tenant_id, ledger_term_id, term_label, academic_year,
       structures, structure_count, term_snapshot_id, created_by_user_id
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
     ON CONFLICT (tenant_id, ledger_term_id)
     DO UPDATE SET
       term_label = EXCLUDED.term_label,
       academic_year = EXCLUDED.academic_year,
       structures = EXCLUDED.structures,
       structure_count = EXCLUDED.structure_count,
       term_snapshot_id = EXCLUDED.term_snapshot_id,
       created_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      tenantId,
      ledgerTermId,
      termLabel,
      academicYear,
      JSON.stringify(structures),
      structures.length,
      termSnapshotId,
      createdByUserId,
    ]
  );

  return mapArchiveRow(insert.rows[0] as Record<string, unknown>);
}

export async function listFeeStructureArchives(tenantId: number): Promise<FeeStructureArchiveRow[]> {
  const res = await query(
    `SELECT id, tenant_id, ledger_term_id, term_label, academic_year,
            structure_count, term_snapshot_id, created_at
     FROM term_fee_structure_archives
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [tenantId]
  );
  return res.rows.map((row) => mapArchiveRow(row as Record<string, unknown>));
}

export async function getFeeStructureArchive(
  tenantId: number,
  archiveId: number
): Promise<FeeStructureArchiveRow | null> {
  const res = await query(
    `SELECT * FROM term_fee_structure_archives WHERE tenant_id = $1 AND id = $2`,
    [tenantId, archiveId]
  );
  if (res.rows.length === 0) return null;
  return mapArchiveRow(res.rows[0] as Record<string, unknown>, true);
}

/** Most recent archive (typically the term closed just before the active one). */
export async function getLatestFeeStructureArchive(
  tenantId: number
): Promise<FeeStructureArchiveRow | null> {
  const res = await query(
    `SELECT * FROM term_fee_structure_archives
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenantId]
  );
  if (res.rows.length === 0) return null;
  return mapArchiveRow(res.rows[0] as Record<string, unknown>, true);
}

async function resolveTargetLedgerTerm(
  tenantId: number,
  targetLedgerTermId?: number | null
): Promise<{ termId: number; academicYearId: number } | null> {
  if (targetLedgerTermId != null && !Number.isNaN(targetLedgerTermId)) {
    const res = await query(
      `SELECT id, academic_year_id FROM terms WHERE tenant_id = $1 AND id = $2`,
      [tenantId, targetLedgerTermId]
    );
    const row = res.rows[0];
    if (!row) return null;
    return { termId: Number(row.id), academicYearId: Number(row.academic_year_id) };
  }

  const check = await checkFeeStructureCompleteness(tenantId);
  if (!check.term_id) return null;
  const res = await query(
    `SELECT id, academic_year_id FROM terms WHERE tenant_id = $1 AND id = $2`,
    [tenantId, check.term_id]
  );
  const row = res.rows[0];
  if (!row) return null;
  return { termId: Number(row.id), academicYearId: Number(row.academic_year_id) };
}

export type ReuseArchiveResult = {
  structuresCopied: number;
  itemsCopied: number;
  skippedExisting: number;
  billingInserted: number;
  targetTermLabel: string | null;
  sourceTermLabel: string;
};

/**
 * Copy archived structures into the active (target) term and bill students —
 * same outcome as entering each class fee structure manually.
 */
export async function reuseArchivedFeeStructures(
  tenantId: number,
  archiveId: number,
  targetLedgerTermId?: number | null
): Promise<ReuseArchiveResult> {
  const archive = await getFeeStructureArchive(tenantId, archiveId);
  if (!archive?.structures?.length) {
    throw new Error('Archived fee structure not found or empty.');
  }

  const target = await resolveTargetLedgerTerm(tenantId, targetLedgerTermId);
  if (!target) {
    throw new Error('Could not resolve the active term for billing.');
  }

  if (archive.ledger_term_id === target.termId) {
    throw new Error('Cannot reuse fees into the same term they were archived from.');
  }

  const termLabelRes = await query(
    `SELECT TRIM(CONCAT(t.name, ' ', ay.name)) AS label
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.id = $1 AND t.tenant_id = $2`,
    [target.termId, tenantId]
  );
  const targetTermLabel = termLabelRes.rows[0]?.label
    ? String(termLabelRes.rows[0].label)
    : null;

  const client = await getClient();
  let structuresCopied = 0;
  let itemsCopied = 0;
  let skippedExisting = 0;

  try {
    await client.query('BEGIN');

    for (const src of archive.structures) {
      const exists = await client.query(
        `SELECT 1 FROM ledger_fee_structures
         WHERE tenant_id = $1 AND class_id = $2 AND term_id = $3
         LIMIT 1`,
        [tenantId, src.class_id, target.termId]
      );
      if (exists.rows.length > 0) {
        skippedExisting++;
        continue;
      }

      const inserted = await client.query(
        `INSERT INTO ledger_fee_structures (
           tenant_id, class_id, academic_year_id, term_id,
           tuition_fee, pta_fee, exam_fee, total
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          tenantId,
          src.class_id,
          target.academicYearId,
          target.termId,
          src.tuition_fee,
          src.pta_fee,
          src.exam_fee,
          src.total,
        ]
      );
      const newId = Number(inserted.rows[0]?.id);
      if (!newId) continue;
      structuresCopied++;

      for (const item of src.items) {
        await client.query(
          `INSERT INTO fee_structure_items (tenant_id, fee_structure_id, item_name, amount, is_active, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [tenantId, newId, item.item_name, item.amount, item.is_active, item.sort_order]
        );
        itemsCopied++;
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // Bill per class — same as POST /fees + items save flow
  for (const src of archive.structures) {
    const hasStructure = await query(
      `SELECT 1 FROM ledger_fee_structures
       WHERE tenant_id = $1 AND class_id = $2 AND term_id = $3`,
      [tenantId, src.class_id, target.termId]
    );
    if (hasStructure.rows.length === 0) continue;
    await postFeesForClass(tenantId, src.class_id, target.academicYearId, target.termId);
  }

  const billing = await (async () => {
    const billClient = await getClient();
    try {
      await billClient.query('BEGIN');
      const result = await executePostFeesForNewTerm(billClient, tenantId, target.termId);
      await billClient.query('COMMIT');
      return result.insertedCount;
    } catch (err) {
      await billClient.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      billClient.release();
    }
  })();

  return {
    structuresCopied,
    itemsCopied,
    skippedExisting,
    billingInserted: billing,
    targetTermLabel,
    sourceTermLabel: archive.term_label,
  };
}
