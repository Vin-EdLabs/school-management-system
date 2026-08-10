import { query } from '../db/connection.js';
import type { PoolClient } from 'pg';

export type BedHistoryReason =
  | 'enrolled'
  | 'converted_to_day'
  | 'transferred'
  | 'term_end'
  | 'unenrolled';

export async function logBedAssignment(
  client: PoolClient | null,
  opts: {
    bedId: number;
    studentId: number;
    tenantId: number;
    termId: number | null;
    assignedDate?: string | null;
    reason: BedHistoryReason;
  }
): Promise<void> {
  const q = client ? client.query.bind(client) : query;
  await q(
    `INSERT INTO boarding_bed_history (bed_id, student_id, tenant_id, term_id, assigned_date, reason)
     VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6)`,
    [opts.bedId, opts.studentId, opts.tenantId, opts.termId, opts.assignedDate ?? null, opts.reason]
  );
}

export async function closeBedHistory(
  client: PoolClient | null,
  opts: {
    bedId: number;
    studentId: number;
    tenantId: number;
    vacatedDate?: string | null;
    reason: BedHistoryReason;
  }
): Promise<void> {
  const q = client ? client.query.bind(client) : query;
  await q(
    `UPDATE boarding_bed_history
     SET vacated_date = COALESCE($4::date, CURRENT_DATE), reason = $5
     WHERE id = (
       SELECT id FROM boarding_bed_history
       WHERE bed_id = $1 AND student_id = $2 AND tenant_id = $3 AND vacated_date IS NULL
       ORDER BY assigned_date DESC NULLS LAST, id DESC
       LIMIT 1
     )`,
    [opts.bedId, opts.studentId, opts.tenantId, opts.vacatedDate ?? null, opts.reason]
  );
}

export async function getBedHistory(bedId: number, tenantId: number) {
  const result = await query(
    `SELECT bh.*,
       s.first_name, s.last_name, s.student_id AS student_code,
       t.name AS term_name
     FROM boarding_bed_history bh
     JOIN students s ON bh.student_id = s.id
     LEFT JOIN terms t ON bh.term_id = t.id
     WHERE bh.bed_id = $1 AND bh.tenant_id = $2
     ORDER BY bh.assigned_date DESC NULLS LAST, bh.id DESC`,
    [bedId, tenantId]
  );
  return result.rows;
}
