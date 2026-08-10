import { query } from '../db/connection.js';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type BoardingFeeRecordRow = {
  id: number;
  tenant_id: number;
  student_id: number;
  term_id: number;
  fee_category: string;
  description: string;
  amount: number;
  amount_paid: number;
  source: string;
  payment_status: 'unpaid' | 'partial' | 'paid' | 'voided';
  is_voided: boolean;
};

export type BoardingFeeAuditTrigger =
  | 'boarding_enrollment'
  | 'day_conversion'
  | 'boarding_disabled'
  | 'admin_refund'
  | 'sync'
  | 'fee_configured';

export async function logBoardingFeeAudit(opts: {
  tenantId: number;
  studentId?: number | null;
  termId?: number | null;
  action: string;
  feeAmount?: number;
  triggeredBy: BoardingFeeAuditTrigger;
  performedBy?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO boarding_fee_audit
       (tenant_id, student_id, term_id, action, fee_amount, triggered_by, performed_by, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      opts.tenantId,
      opts.studentId ?? null,
      opts.termId ?? null,
      opts.action,
      opts.feeAmount ?? null,
      opts.triggeredBy,
      opts.performedBy ?? null,
      JSON.stringify(opts.metadata ?? {}),
    ]
  );
}

export async function listActiveBoardingFeeRecords(
  tenantId: number,
  studentId: number,
  termId: number
): Promise<BoardingFeeRecordRow[]> {
  const res = await query(
    `SELECT id, tenant_id, student_id, term_id, fee_category, description, amount, amount_paid,
            source, payment_status, is_voided
     FROM student_fee_records
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
       AND source = 'boarding' AND is_voided = FALSE
     ORDER BY fee_category`,
    [tenantId, studentId, termId]
  );
  return res.rows.map(parseRecordRow);
}

export async function syncBoardingFeeRecordPaymentStatus(
  tenantId: number,
  studentId: number,
  termId: number
): Promise<void> {
  const { computeBoardingPaidPortion } = await import('./boardingFeeService.js');
  const records = await listActiveBoardingFeeRecords(tenantId, studentId, termId);
  if (records.length === 0) return;

  const { paidPortion, boardingTotal } = await computeBoardingPaidPortion(tenantId, studentId, termId);
  if (boardingTotal <= 0) return;

  let remainingPaid = paidPortion;
  for (const rec of records) {
    const share = roundMoney(Math.min(rec.amount, Math.max(0, remainingPaid)));
    remainingPaid = roundMoney(Math.max(0, remainingPaid - share));
    const status =
      share <= 0 ? 'unpaid' : share >= rec.amount - 0.001 ? 'paid' : 'partial';
    await query(
      `UPDATE student_fee_records
       SET amount_paid = $1, payment_status = $2, updated_at = NOW()
       WHERE id = $3`,
      [share, status, rec.id]
    );
  }
}

function parseRecordRow(row: Record<string, unknown>): BoardingFeeRecordRow {
  return {
    id: Number(row.id),
    tenant_id: Number(row.tenant_id),
    student_id: Number(row.student_id),
    term_id: Number(row.term_id),
    fee_category: String(row.fee_category),
    description: String(row.description ?? ''),
    amount: roundMoney(Number(row.amount) || 0),
    amount_paid: roundMoney(Number(row.amount_paid) || 0),
    source: String(row.source),
    payment_status: String(row.payment_status) as BoardingFeeRecordRow['payment_status'],
    is_voided: row.is_voided === true,
  };
}

export async function upsertBoardingFeeRecord(opts: {
  tenantId: number;
  studentId: number;
  termId: number;
  feeCategory: 'boarding_lodging' | 'boarding_feeding';
  description: string;
  amount: number;
  triggeredBy: BoardingFeeAuditTrigger;
  performedBy?: number | null;
}): Promise<'created' | 'restored' | 'updated' | 'unchanged'> {
  if (opts.amount <= 0) return 'unchanged';

  const existing = await query(
    `SELECT id, amount, is_voided FROM student_fee_records
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
       AND fee_category = $4 AND source = 'boarding'
     LIMIT 1`,
    [opts.tenantId, opts.studentId, opts.termId, opts.feeCategory]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.is_voided) {
      await query(
        `UPDATE student_fee_records
         SET amount = $1, description = $2, is_voided = FALSE, payment_status = 'unpaid',
             amount_paid = 0, updated_at = NOW()
         WHERE id = $3`,
        [opts.amount, opts.description, row.id]
      );
      await logBoardingFeeAudit({
        tenantId: opts.tenantId,
        studentId: opts.studentId,
        termId: opts.termId,
        action: 'restored',
        feeAmount: opts.amount,
        triggeredBy: opts.triggeredBy,
        performedBy: opts.performedBy,
      });
      return 'restored';
    }
    const current = roundMoney(Number(row.amount) || 0);
    if (Math.abs(current - opts.amount) > 0.001) {
      await query(
        `UPDATE student_fee_records SET amount = $1, description = $2, updated_at = NOW() WHERE id = $3`,
        [opts.amount, opts.description, row.id]
      );
      return 'updated';
    }
    return 'unchanged';
  }

  await query(
    `INSERT INTO student_fee_records
       (tenant_id, student_id, term_id, fee_category, description, amount, source, payment_status, is_voided)
     VALUES ($1, $2, $3, $4, $5, $6, 'boarding', 'unpaid', FALSE)`,
    [opts.tenantId, opts.studentId, opts.termId, opts.feeCategory, opts.description, opts.amount]
  );
  await logBoardingFeeAudit({
    tenantId: opts.tenantId,
    studentId: opts.studentId,
    termId: opts.termId,
    action: 'applied',
    feeAmount: opts.amount,
    triggeredBy: opts.triggeredBy,
    performedBy: opts.performedBy,
  });
  return 'created';
}

export async function voidBoardingFeeRecords(opts: {
  tenantId: number;
  studentId: number;
  termId: number;
  triggeredBy: BoardingFeeAuditTrigger;
  performedBy?: number | null;
}): Promise<number> {
  const res = await query(
    `UPDATE student_fee_records
     SET is_voided = TRUE, payment_status = 'voided', updated_at = NOW()
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
       AND source = 'boarding' AND is_voided = FALSE AND payment_status = 'unpaid'
     RETURNING id, amount, fee_category`,
    [opts.tenantId, opts.studentId, opts.termId]
  );

  for (const row of res.rows) {
    await logBoardingFeeAudit({
      tenantId: opts.tenantId,
      studentId: opts.studentId,
      termId: opts.termId,
      action: 'voided',
      feeAmount: roundMoney(Number(row.amount) || 0),
      triggeredBy: opts.triggeredBy,
      performedBy: opts.performedBy,
      metadata: { fee_category: row.fee_category },
    });
  }

  return res.rows.length;
}

/** Void all fully-unpaid boarding fee records for a term (boarding module disabled). */
export async function voidAllUnpaidBoardingFees(
  tenantId: number,
  termId: number,
  performedBy?: number | null
): Promise<{ voided: number; flagged: number }> {
  const enrollments = await query(
    `SELECT DISTINCT student_id FROM student_fee_records
     WHERE tenant_id = $1 AND term_id = $2 AND source = 'boarding' AND is_voided = FALSE`,
    [tenantId, termId]
  );

  let voided = 0;
  let flagged = 0;

  const { computeBoardingPaidPortion } = await import('./boardingFeeService.js');

  for (const row of enrollments.rows) {
    const studentId = Number(row.student_id);
    const { paidPortion, unpaidPortion } = await computeBoardingPaidPortion(tenantId, studentId, termId);

    if (paidPortion > 0.001 && unpaidPortion > 0.001) {
      flagged++;
      await logBoardingFeeAudit({
        tenantId,
        studentId,
        termId,
        action: 'flagged_partial',
        feeAmount: unpaidPortion,
        triggeredBy: 'boarding_disabled',
        performedBy,
        metadata: { paidPortion, message: 'Partial boarding payment — admin review required' },
      });
      continue;
    }

    if (paidPortion > 0.001) {
      await syncBoardingFeeRecordPaymentStatus(tenantId, studentId, termId);
      continue;
    }

    const count = await voidBoardingFeeRecords({
      tenantId,
      studentId,
      termId,
      triggeredBy: 'boarding_disabled',
      performedBy,
    });
    voided += count;
  }

  if (voided > 0 || flagged > 0) {
    await logBoardingFeeAudit({
      tenantId,
      termId,
      action: 'bulk_void_unpaid',
      feeAmount: voided,
      triggeredBy: 'boarding_disabled',
      performedBy,
      metadata: { voidedRecords: voided, flaggedPartial: flagged },
    });
  }

  return { voided, flagged };
}

export async function getBoardingFeeRecordsForStatement(
  tenantId: number,
  studentId: number,
  termId: number,
  opts: { includeVoided?: boolean } = {}
): Promise<BoardingFeeRecordRow[]> {
  const res = await query(
    `SELECT id, tenant_id, student_id, term_id, fee_category, description, amount, amount_paid,
            source, payment_status, is_voided
     FROM student_fee_records
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3 AND source = 'boarding'
       ${opts.includeVoided ? '' : 'AND is_voided = FALSE'}
     ORDER BY fee_category`,
    [tenantId, studentId, termId]
  );
  return res.rows.map(parseRecordRow);
}
