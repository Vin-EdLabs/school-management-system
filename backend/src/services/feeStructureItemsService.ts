import type pg from 'pg';
import { query, getClient } from '../db/connection.js';

export type FeeStructureItemInput = {
  item_name: string;
  amount: number;
  is_active: boolean;
  sort_order: number;
};

export type FeeStructureItemRow = FeeStructureItemInput & {
  id?: number;
  is_required?: boolean;
};

export const DEFAULT_FEE_STRUCTURE_ITEMS: FeeStructureItemRow[] = [
  { item_name: 'Tuition', amount: 0, is_active: true, sort_order: 1, is_required: true },
  { item_name: 'PTA', amount: 0, is_active: false, sort_order: 2, is_required: false },
  { item_name: 'ICT', amount: 0, is_active: false, sort_order: 3, is_required: false },
  { item_name: 'Library', amount: 0, is_active: false, sort_order: 4, is_required: false },
  { item_name: 'Exam Fees', amount: 0, is_active: false, sort_order: 5, is_required: false },
];

export function buildItemsSummaryLabel(items: Array<{ item_name: string }>): string {
  return items.map(i => i.item_name.trim()).filter(Boolean).join(' + ');
}

export function validateFeeStructureItems(items: FeeStructureItemInput[]): string | null {
  const tuition = items.find(i => i.item_name.trim().toLowerCase() === 'tuition');
  if (!tuition || !tuition.is_active) {
    return 'Tuition must be present and enabled';
  }
  const tuitionAmount = Number(tuition.amount);
  if (Number.isNaN(tuitionAmount) || tuitionAmount < 0) {
    return 'Tuition amount cannot be negative';
  }
  for (const item of items) {
    if (item.item_name.trim().toLowerCase() === 'tuition') continue;
    if (item.is_active && Number(item.amount) <= 0) {
      return `${item.item_name} is enabled but has no amount`;
    }
    if (item.is_active && Number(item.amount) < 0) {
      return `${item.item_name} amount cannot be negative`;
    }
  }
  return null;
}

export async function assertLedgerFeeStructure(tenantId: number, feeStructureId: number) {
  const res = await query(
    `SELECT id, total, tuition_fee FROM ledger_fee_structures WHERE id = $1 AND tenant_id = $2`,
    [feeStructureId, tenantId]
  );
  if (res.rows.length === 0) {
    return null;
  }
  return res.rows[0] as { id: number; total: number; tuition_fee: number };
}

export async function getFeeStructureItems(tenantId: number, feeStructureId: number) {
  const structure = await assertLedgerFeeStructure(tenantId, feeStructureId);
  if (!structure) return null;

  const res = await query(
    `SELECT id, item_name, amount, is_active, sort_order
     FROM fee_structure_items
     WHERE tenant_id = $1 AND fee_structure_id = $2
     ORDER BY sort_order ASC, id ASC`,
    [tenantId, feeStructureId]
  );

  if (res.rows.length === 0) {
    const total = Number(structure.total) || 0;
    return DEFAULT_FEE_STRUCTURE_ITEMS.map(row => ({
      ...row,
      amount: row.item_name === 'Tuition' && total > 0 ? total : 0,
      is_active: row.item_name === 'Tuition' ? true : row.is_active,
    }));
  }

  return res.rows.map(row => ({
    id: row.id,
    item_name: row.item_name,
    amount: Number(row.amount) || 0,
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order) || 0,
    is_required: String(row.item_name).trim().toLowerCase() === 'tuition',
  }));
}

export async function getFeeStructureItemsSummary(tenantId: number, feeStructureId: number) {
  const items = await getFeeStructureItems(tenantId, feeStructureId);
  if (!items) return null;

  const active = items.filter(i => i.is_active && Number(i.amount) > 0);
  const total = active.reduce((sum, i) => sum + Number(i.amount), 0);
  return {
    total,
    items: active.map(i => ({ item_name: i.item_name, amount: Number(i.amount) })),
    label: buildItemsSummaryLabel(active),
  };
}

export function formatFeeItemLabel(name: string): string {
  const trimmed = String(name || '').trim();
  if (!trimmed) return trimmed;
  if (/fee$/i.test(trimmed)) return trimmed;
  return `${trimmed} Fee`;
}

export function linesFromFeeStructureItems(
  items: Array<{ item_name: string; amount: number; is_active?: boolean }>
): Array<{ label: string; amount: number }> {
  return items
    .filter(i => i.is_active !== false && Number(i.amount) > 0)
    .map(i => ({
      label: formatFeeItemLabel(i.item_name),
      amount: Number(i.amount) || 0,
    }));
}

export async function loadActiveFeeStructureLinesByClassTerm(
  tenantId: number,
  classId: number,
  termId: number
): Promise<{ lines: Array<{ label: string; amount: number }>; subtotal: number } | null> {
  const fsRes = await query(
    `SELECT id FROM ledger_fee_structures
     WHERE tenant_id = $1 AND class_id = $2 AND term_id = $3
     LIMIT 1`,
    [tenantId, classId, termId]
  );
  if (fsRes.rows.length === 0) return null;

  const feeStructureId = Number(fsRes.rows[0].id);
  const items = await getFeeStructureItems(tenantId, feeStructureId);
  if (!items) return null;

  const lines = linesFromFeeStructureItems(items);
  const subtotal = Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  return { lines, subtotal };
}

/** Resolve fee structure by student (class id or normalized class name) then load line items. */
export async function loadActiveFeeStructureLinesForStudent(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId: number
): Promise<{ lines: Array<{ label: string; amount: number }>; subtotal: number } | null> {
  const { resolveLedgerFeeStructureForStudent } = await import('./effectiveStudentBalanceService.js');
  const resolved = await resolveLedgerFeeStructureForStudent(client, tenantId, studentId, termId);
  if (!resolved) return null;

  const items = await getFeeStructureItems(tenantId, resolved.feeStructureId);
  if (!items) {
    if (resolved.grossTotal < 0) return null;
    return {
      lines: resolved.grossTotal > 0 ? [{ label: 'Tuition Fee', amount: resolved.grossTotal }] : [],
      subtotal: resolved.grossTotal,
    };
  }

  const lines = linesFromFeeStructureItems(items);
  const subtotal = Math.round(
    (lines.reduce((sum, line) => sum + line.amount, 0) || resolved.grossTotal) * 100
  ) / 100;
  return { lines, subtotal };
}

export async function loadActiveFeeStructureLinesBatch(
  tenantId: number,
  feeStructureIds: number[]
): Promise<Map<number, Array<{ label: string; amount: number }>>> {
  const map = new Map<number, Array<{ label: string; amount: number }>>();
  if (feeStructureIds.length === 0) return map;

  const itemsRes = await query(
    `SELECT fee_structure_id, item_name, amount, sort_order
     FROM fee_structure_items
     WHERE tenant_id = $1
       AND fee_structure_id = ANY($2::int[])
       AND is_active = true
       AND amount > 0
     ORDER BY sort_order ASC, id ASC`,
    [tenantId, feeStructureIds]
  );

  for (const row of itemsRes.rows) {
    const id = Number(row.fee_structure_id);
    const list = map.get(id) || [];
    list.push({
      label: formatFeeItemLabel(String(row.item_name)),
      amount: Number(row.amount) || 0,
    });
    map.set(id, list);
  }

  return map;
}

export async function saveFeeStructureItems(
  tenantId: number,
  feeStructureId: number,
  rawItems: FeeStructureItemInput[]
) {
  const structure = await assertLedgerFeeStructure(tenantId, feeStructureId);
  if (!structure) return null;

  const normalized = rawItems.map((item, index) => ({
    item_name: String(item.item_name || '').trim(),
    amount: item.is_active ? Number(item.amount) || 0 : 0,
    is_active: Boolean(item.is_active),
    sort_order: item.sort_order != null ? Number(item.sort_order) : index + 1,
  }));

  const validationError = validateFeeStructureItems(normalized);
  if (validationError) {
    throw new Error(validationError);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM fee_structure_items WHERE tenant_id = $1 AND fee_structure_id = $2`,
      [tenantId, feeStructureId]
    );

    for (const item of normalized) {
      await client.query(
        `INSERT INTO fee_structure_items (tenant_id, fee_structure_id, item_name, amount, is_active, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, feeStructureId, item.item_name, item.amount, item.is_active, item.sort_order]
      );
    }

    const totalRes = await client.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM fee_structure_items
       WHERE tenant_id = $1 AND fee_structure_id = $2 AND is_active = true`,
      [tenantId, feeStructureId]
    );
    const total = Number(totalRes.rows[0]?.total) || 0;
    const tuitionAmount =
      normalized.find(i => i.item_name.toLowerCase() === 'tuition' && i.is_active)?.amount ?? total;

    await client.query(
      `UPDATE ledger_fee_structures
       SET total = $1, tuition_fee = $2
       WHERE id = $3 AND tenant_id = $4`,
      [total, tuitionAmount, feeStructureId, tenantId]
    );

    await client.query(
      `UPDATE fee_structures fs
       SET amount = $1, updated_at = CURRENT_TIMESTAMP
       FROM ledger_fee_structures lfs
       JOIN terms t ON t.id = lfs.term_id
       JOIN academic_years ay ON ay.id = lfs.academic_year_id
       WHERE fs.tenant_id = lfs.tenant_id
         AND fs.class_id = lfs.class_id
         AND fs.term = TRIM(CONCAT(t.name, ' ', ay.name))
         AND lfs.id = $2
         AND fs.tenant_id = $3`,
      [total, feeStructureId, tenantId]
    ).catch(() => undefined);

    await client.query('COMMIT');

    const items = await getFeeStructureItems(tenantId, feeStructureId);
    return { items, total };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
