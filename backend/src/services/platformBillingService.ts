import { query } from '../db/connection.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from './auditService.js';
import { ACTIVE_STUDENT_WHERE } from '../utils/studentEnrollment.js';
import { getActiveAcademicTermId } from './studentTermTrackingService.js';
import { resolveSchoolDisplayName } from './schoolBrandingService.js';
import { resolvePlatformPaystackKeys } from './platformPaystackService.js';
import { createGlobalAnnouncement, emitGlobalAnnouncementLiveEvent } from './globalAnnouncementService.js';
import {
  buildPlatformBillingReference,
  parsePlatformBillingReference,
  paystackInitializeTransaction,
  paystackVerifyTransaction,
  verifyPaystackSignature,
  ghsToKobo,
  koboToGhs,
} from './paystackService.js';

export type BillingFrequency = 'termly' | 'yearly' | 'monthly';
export type InvoiceStatus = 'pending' | 'paid' | 'waived' | 'cancelled';

export type PlatformBillingConfig = {
  tenantId: number;
  billingFrequency: BillingFrequency;
  pricePerStudentTermly: number;
  pricePerStudentYearly: number;
  pricePerStudentMonthly: number;
  updatedAt: string | null;
};

export type PlatformInvoice = {
  id: number;
  tenantId: number;
  invoiceNumber: string | null;
  billingFrequency: BillingFrequency;
  studentCount: number;
  pricePerStudent: number;
  computedAmount: number;
  finalAmount: number;
  note: string | null;
  periodLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  dueDate: string | null;
  status: InvoiceStatus;
  paystackReference: string | null;
  paidAt: string | null;
  paidAmount: number | null;
  postedBy: number | null;
  createdAt: string;
};

type Row = Record<string, unknown>;

/** pg returns DATE columns as JS Date objects by default — String(date) gives a
 * human-readable format ("Sun Aug 09 2026 …"), not ISO, which breaks any later
 * date-typed query param. Always go through toISOString() for Date instances. */
function toDateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value).trim();
  return s ? s.split('T')[0].slice(0, 10) : null;
}

function mapConfig(row: Row): PlatformBillingConfig {
  return {
    tenantId: Number(row.tenant_id),
    billingFrequency: row.billing_frequency as BillingFrequency,
    pricePerStudentTermly: parseFloat(String(row.price_per_student_termly)) || 0,
    pricePerStudentYearly: parseFloat(String(row.price_per_student_yearly)) || 0,
    pricePerStudentMonthly: parseFloat(String(row.price_per_student_monthly)) || 0,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function mapInvoice(row: Row): PlatformInvoice {
  return {
    id: Number(row.id),
    tenantId: Number(row.tenant_id),
    invoiceNumber: (row.invoice_number as string) || null,
    billingFrequency: row.billing_frequency as BillingFrequency,
    studentCount: Number(row.student_count),
    pricePerStudent: parseFloat(String(row.price_per_student)) || 0,
    computedAmount: parseFloat(String(row.computed_amount)) || 0,
    finalAmount: parseFloat(String(row.final_amount)) || 0,
    note: (row.note as string) || null,
    periodLabel: (row.period_label as string) || null,
    periodStart: toDateOnly(row.period_start),
    periodEnd: toDateOnly(row.period_end),
    dueDate: toDateOnly(row.due_date),
    status: row.status as InvoiceStatus,
    paystackReference: (row.paystack_reference as string) || null,
    paidAt: row.paid_at ? String(row.paid_at) : null,
    paidAmount: row.paid_amount != null ? parseFloat(String(row.paid_amount)) : null,
    postedBy: row.posted_by != null ? Number(row.posted_by) : null,
    createdAt: String(row.created_at),
  };
}

function emitBillingChanged(tenantId: number, action: 'created' | 'updated') {
  try {
    getIO().to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: 'platform-billing',
      action,
      at: Date.now(),
    });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

/** Active (non-withdrawn/graduated) student count — same rule used everywhere else in the app. */
export async function getActiveStudentCount(tenantId: number): Promise<number> {
  const res = await query(
    `SELECT COUNT(*)::int AS count FROM students s WHERE s.tenant_id = $1 AND ${ACTIVE_STUDENT_WHERE}`,
    [tenantId]
  );
  return Number(res.rows[0]?.count) || 0;
}

export async function getBillingConfig(tenantId: number): Promise<PlatformBillingConfig | null> {
  const res = await query(`SELECT * FROM platform_billing_config WHERE tenant_id = $1`, [tenantId]);
  return res.rows.length ? mapConfig(res.rows[0]) : null;
}

export async function upsertBillingConfig(
  tenantId: number,
  input: {
    billingFrequency: BillingFrequency;
    pricePerStudentTermly: number;
    pricePerStudentYearly: number;
    pricePerStudentMonthly: number;
  },
  updatedBy: number
): Promise<PlatformBillingConfig> {
  const res = await query(
    `INSERT INTO platform_billing_config
       (tenant_id, billing_frequency, price_per_student_termly, price_per_student_yearly, price_per_student_monthly, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       billing_frequency = EXCLUDED.billing_frequency,
       price_per_student_termly = EXCLUDED.price_per_student_termly,
       price_per_student_yearly = EXCLUDED.price_per_student_yearly,
       price_per_student_monthly = EXCLUDED.price_per_student_monthly,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING *`,
    [
      tenantId,
      input.billingFrequency,
      input.pricePerStudentTermly,
      input.pricePerStudentYearly,
      input.pricePerStudentMonthly,
      updatedBy,
    ]
  );
  return mapConfig(res.rows[0]);
}

function tierPrice(config: PlatformBillingConfig): number {
  if (config.billingFrequency === 'yearly') return config.pricePerStudentYearly;
  if (config.billingFrequency === 'monthly') return config.pricePerStudentMonthly;
  return config.pricePerStudentTermly;
}

async function computePeriod(
  tenantId: number,
  frequency: BillingFrequency
): Promise<{ label: string; start: string | null; end: string | null }> {
  if (frequency === 'monthly') {
    const now = new Date();
    const label = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { label, start, end };
  }

  if (frequency === 'yearly') {
    const res = await query(
      `SELECT name, start_date, end_date FROM academic_years
       WHERE tenant_id = $1
       ORDER BY is_current DESC NULLS LAST, id DESC
       LIMIT 1`,
      [tenantId]
    );
    const row = res.rows[0];
    return {
      label: row?.name ? String(row.name) : 'Current academic year',
      start: toDateOnly(row?.start_date),
      end: toDateOnly(row?.end_date),
    };
  }

  const termId = await getActiveAcademicTermId(tenantId);
  if (!termId) return { label: 'Current term', start: null, end: null };
  const res = await query(
    `SELECT term_name, year, start_date, end_date FROM academic_terms WHERE id = $1`,
    [termId]
  );
  const row = res.rows[0];
  if (!row) return { label: 'Current term', start: null, end: null };
  return {
    label: `${String(row.term_name || '').trim()} ${String(row.year || '').trim()}`.trim(),
    start: toDateOnly(row.start_date),
    end: toDateOnly(row.end_date),
  };
}

export async function postInvoice(
  tenantId: number,
  input: { finalAmount?: number | null; note?: string | null; dueDate?: string | null },
  actorUserId: number,
  ipAddress: string | null,
  userAgent: string | null
): Promise<PlatformInvoice> {
  const config = await getBillingConfig(tenantId);
  if (!config) {
    throw Object.assign(new Error('Set up a billing frequency and price per student for this school first.'), {
      status: 400,
    });
  }

  const price = tierPrice(config);
  const studentCount = await getActiveStudentCount(tenantId);
  const computedAmount = Math.round(studentCount * price * 100) / 100;
  const finalAmount =
    input.finalAmount != null && Number.isFinite(input.finalAmount) && input.finalAmount >= 0
      ? Math.round(Number(input.finalAmount) * 100) / 100
      : computedAmount;

  const period = await computePeriod(tenantId, config.billingFrequency);
  const dueDate = input.dueDate?.trim() || defaultDueDate();
  const isWaived = finalAmount <= 0;
  const note = input.note?.trim() || null;

  const insertRes = await query(
    `INSERT INTO platform_invoices
       (tenant_id, billing_frequency, student_count, price_per_student, computed_amount, final_amount,
        note, period_label, period_start, period_end, due_date, status, posted_by, paid_at, paid_amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      tenantId,
      config.billingFrequency,
      studentCount,
      price,
      computedAmount,
      finalAmount,
      note,
      period.label,
      period.start,
      period.end,
      dueDate,
      isWaived ? 'waived' : 'pending',
      actorUserId,
      isWaived ? new Date().toISOString() : null,
      isWaived ? 0 : null,
    ]
  );

  const row = insertRes.rows[0] as Row;
  const invoiceNumber = `PB-${String(tenantId).padStart(4, '0')}-${String(row.id).padStart(6, '0')}`;
  await query(`UPDATE platform_invoices SET invoice_number = $1 WHERE id = $2`, [invoiceNumber, row.id]);
  row.invoice_number = invoiceNumber;

  const schoolName = await resolveSchoolDisplayName(tenantId);

  await writeAuditLog({
    tenantId,
    userId: actorUserId,
    userRole: 'super-admin',
    action: 'PLATFORM_INVOICE_POSTED',
    entityType: 'PLATFORM_INVOICE',
    entityId: Number(row.id),
    module: 'super-admin',
    summary: `Platform bill posted for ${schoolName} — ${invoiceNumber} — GHS ${finalAmount.toFixed(2)} (${period.label})`,
    details: {
      invoiceNumber,
      billingFrequency: config.billingFrequency,
      studentCount,
      pricePerStudent: price,
      computedAmount,
      finalAmount,
      note,
      periodLabel: period.label,
      dueDate,
      status: row.status,
    },
    ipAddress,
    userAgent,
  });

  try {
    const amountLabel = isWaived ? 'GH₵ 0.00 (fully waived)' : `GH₵ ${finalAmount.toFixed(2)}`;
    const bodyLines = [
      `${invoiceNumber} — ${period.label}`,
      `Amount ${isWaived ? 'waived' : 'due'}: ${amountLabel}${!isWaived && dueDate ? ` (due ${dueDate})` : ''}`,
      `Active students billed: ${studentCount}`,
    ];
    if (note) bodyLines.push(`Note from ScholarNerve: ${note}`);

    const announcement = await createGlobalAnnouncement(
      {
        title: isWaived ? `Bill waived — ${invoiceNumber}` : `New invoice — ${invoiceNumber}`,
        body: bodyLines.join('\n'),
        type: 'invoice',
        target: 'selected',
        targetTenantIds: [tenantId],
        isActive: true,
      },
      actorUserId
    );
    await emitGlobalAnnouncementLiveEvent(announcement);
  } catch (err) {
    console.error('[platformBilling] notification failed:', err);
  }

  emitBillingChanged(tenantId, 'created');
  return mapInvoice(row);
}

export async function getCurrentOutstandingInvoice(tenantId: number): Promise<PlatformInvoice | null> {
  const res = await query(
    `SELECT * FROM platform_invoices WHERE tenant_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  );
  return res.rows.length ? mapInvoice(res.rows[0]) : null;
}

export async function listInvoicesForTenant(tenantId: number): Promise<PlatformInvoice[]> {
  const res = await query(`SELECT * FROM platform_invoices WHERE tenant_id = $1 ORDER BY created_at DESC`, [
    tenantId,
  ]);
  return res.rows.map(mapInvoice);
}

export async function getInvoiceById(tenantId: number, invoiceId: number): Promise<PlatformInvoice | null> {
  const res = await query(`SELECT * FROM platform_invoices WHERE id = $1 AND tenant_id = $2`, [
    invoiceId,
    tenantId,
  ]);
  return res.rows.length ? mapInvoice(res.rows[0]) : null;
}

/** Super admin manually reconciling an off-platform payment (bank transfer, cash, momo, etc). */
export async function markInvoicePaidManually(
  tenantId: number,
  invoiceId: number,
  actorUserId: number,
  ipAddress: string | null,
  userAgent: string | null
): Promise<PlatformInvoice> {
  const res = await query(`SELECT * FROM platform_invoices WHERE id = $1 AND tenant_id = $2`, [
    invoiceId,
    tenantId,
  ]);
  const row = res.rows[0] as Row | undefined;
  if (!row) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (row.status === 'paid') return mapInvoice(row);
  if (row.status === 'waived' || row.status === 'cancelled') {
    throw Object.assign(new Error('This invoice is already settled.'), { status: 400 });
  }

  const finalAmount = parseFloat(String(row.final_amount)) || 0;
  const updateRes = await query(
    `UPDATE platform_invoices
     SET status = 'paid', paid_at = NOW(), paid_amount = $1, paystack_reference = COALESCE(paystack_reference, 'MANUAL'), updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3 AND status != 'paid'
     RETURNING *`,
    [finalAmount, invoiceId, tenantId]
  );
  const updated = (updateRes.rows[0] as Row) || row;

  await writeAuditLog({
    tenantId,
    userId: actorUserId,
    userRole: 'super-admin',
    action: 'PLATFORM_INVOICE_MARKED_PAID',
    entityType: 'PLATFORM_INVOICE',
    entityId: invoiceId,
    module: 'super-admin',
    summary: `Super admin manually marked invoice ${updated.invoice_number || invoiceId} as paid — GH₵ ${finalAmount.toFixed(2)}`,
    details: { invoiceId, finalAmount },
    ipAddress,
    userAgent,
  });

  emitBillingChanged(tenantId, 'updated');
  return mapInvoice(updated);
}

export async function initializePlatformInvoicePayment(
  tenantId: number,
  invoiceId: number,
  payerEmail: string,
  callbackUrl?: string
): Promise<{ authorizationUrl: string; reference: string; accessCode: string }> {
  const res = await query(`SELECT * FROM platform_invoices WHERE id = $1 AND tenant_id = $2`, [
    invoiceId,
    tenantId,
  ]);
  const row = res.rows[0] as Row | undefined;
  if (!row) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (row.status === 'paid' || row.status === 'waived') {
    throw Object.assign(new Error('This invoice is already settled.'), { status: 400 });
  }
  if (row.status === 'cancelled') {
    throw Object.assign(new Error('This invoice was cancelled.'), { status: 400 });
  }

  const finalAmount = parseFloat(String(row.final_amount)) || 0;
  if (finalAmount <= 0) {
    throw Object.assign(new Error('This invoice has no balance due.'), { status: 400 });
  }

  const platform = await resolvePlatformPaystackKeys();
  if (!platform.secretKey) {
    throw Object.assign(new Error('ScholarNerve Paystack is not configured yet. Contact ScholarNerve support.'), {
      status: 503,
    });
  }

  const reference = buildPlatformBillingReference(tenantId, invoiceId);
  await query(`UPDATE platform_invoices SET paystack_reference = $1, updated_at = NOW() WHERE id = $2`, [
    reference,
    invoiceId,
  ]);

  const init = await paystackInitializeTransaction(platform.secretKey, {
    email: payerEmail,
    amountKobo: ghsToKobo(finalAmount),
    reference,
    callbackUrl,
    metadata: { tenantId, invoiceId, kind: 'platform_billing' },
    feeBearer: 'school',
  });

  return { authorizationUrl: init.authorization_url, reference: init.reference, accessCode: init.access_code };
}

async function finalizePlatformInvoicePayment(
  tenantId: number,
  invoiceId: number,
  data: { paidAt: string | null; amountKobo: number }
): Promise<PlatformInvoice> {
  const existing = await query(`SELECT * FROM platform_invoices WHERE id = $1 AND tenant_id = $2`, [
    invoiceId,
    tenantId,
  ]);
  const row = existing.rows[0] as Row | undefined;
  if (!row) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (row.status === 'paid') return mapInvoice(row); // idempotent — already finalized

  const paidAmount = koboToGhs(data.amountKobo);
  const paidAtIso = data.paidAt ? new Date(data.paidAt).toISOString() : new Date().toISOString();

  const updateRes = await query(
    `UPDATE platform_invoices
     SET status = 'paid', paid_at = $1, paid_amount = $2, updated_at = NOW()
     WHERE id = $3 AND tenant_id = $4 AND status != 'paid'
     RETURNING *`,
    [paidAtIso, paidAmount, invoiceId, tenantId]
  );
  const updated = (updateRes.rows[0] as Row) || row;

  try {
    await writeAuditLog({
      tenantId,
      userId: null,
      userRole: 'system',
      action: 'PLATFORM_INVOICE_PAID',
      entityType: 'PLATFORM_INVOICE',
      entityId: invoiceId,
      module: 'billing',
      summary: `Platform invoice #${updated.invoice_number || invoiceId} paid — GHS ${paidAmount.toFixed(2)}`,
      details: { invoiceId, paidAmount, paidAt: paidAtIso },
      ipAddress: null,
      userAgent: null,
    });
  } catch (err) {
    console.error('[platformBilling] audit log for payment failed:', err);
  }

  emitBillingChanged(tenantId, 'updated');
  return mapInvoice(updated);
}

/** Called right after the school returns from the Paystack checkout — synchronous confirmation path. */
export async function verifyPlatformInvoicePayment(reference: string): Promise<PlatformInvoice> {
  const parsed = parsePlatformBillingReference(reference);
  if (!parsed) throw Object.assign(new Error('Invalid payment reference'), { status: 400 });

  const res = await query(`SELECT * FROM platform_invoices WHERE id = $1 AND tenant_id = $2`, [
    parsed.invoiceId,
    parsed.tenantId,
  ]);
  const row = res.rows[0] as Row | undefined;
  if (!row) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (row.status === 'paid') return mapInvoice(row);

  const platform = await resolvePlatformPaystackKeys();
  if (!platform.secretKey) {
    throw Object.assign(new Error('ScholarNerve Paystack is not configured'), { status: 503 });
  }

  const verified = await paystackVerifyTransaction(platform.secretKey, reference);
  if (verified.status !== 'success') {
    throw Object.assign(new Error(`Payment not successful (status: ${verified.status})`), { status: 400 });
  }

  return finalizePlatformInvoicePayment(parsed.tenantId, parsed.invoiceId, {
    paidAt: verified.paid_at,
    amountKobo: verified.amount,
  });
}

/** Called from the shared Paystack webhook dispatcher for SNBILL-* references (belt-and-suspenders vs. verify). */
export async function handlePlatformBillingWebhookEvent(
  rawBody: Buffer,
  signature: string,
  payload: { event?: string; data?: { reference?: string; amount?: number; paid_at?: string } }
): Promise<void> {
  const reference = payload.data?.reference;
  if (!reference) return;
  const parsed = parsePlatformBillingReference(reference);
  if (!parsed) return;

  const platform = await resolvePlatformPaystackKeys();
  if (!platform.secretKey) {
    console.error('[platform billing webhook] Platform Paystack not configured');
    return;
  }
  if (!verifyPaystackSignature(rawBody, signature, platform.secretKey)) {
    console.error('[platform billing webhook] Invalid signature for tenant', parsed.tenantId);
    return;
  }

  if (payload.event === 'charge.success') {
    await finalizePlatformInvoicePayment(parsed.tenantId, parsed.invoiceId, {
      paidAt: payload.data?.paid_at || null,
      amountKobo: Number(payload.data?.amount || 0),
    });
  }
}
