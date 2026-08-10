import type pg from 'pg';
import { getClient, query } from '../db/connection.js';
import { encryptField } from '../utils/fieldEncryption.js';
import { recordPaymentWithLedger } from './ledgerPaymentService.js';
import {
  buildPaymentReference,
  estimatePaystackFeeKobo,
  getTenantPaystackConfig,
  ghsToKobo,
  koboToGhs,
  parsePaymentReference,
  paystackInitializeTransaction,
  paystackVerifyTransaction,
  resolvePaystackPublicKey,
  resolvePaystackSecretKey,
  verifyPaystackSignature,
  isTenantOnlinePaymentEffective,
  type PaystackFeeBearer,
  type PaystackMode,
  type TenantPaystackConfig,
} from './paystackService.js';
import { getIO } from '../socket.js';
import { sendPushToStudentParents } from './webPushService.js';
import { resolveActiveLedgerTerm } from './studentUnifiedBalanceService.js';
import { getStudentBalanceFromLedger } from './ledgerBalanceService.js';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Ensure online payment amount does not exceed live ledger outstanding (includes boarding fees). */
export async function validatePaymentAmountAgainstOutstanding(
  tenantId: number,
  studentId: number,
  amountGhs: number
): Promise<{ ok: boolean; outstanding: number; totalDue: number }> {
  const { ledgerTermId } = await resolveActiveLedgerTerm(query, tenantId);
  if (!ledgerTermId) {
    return { ok: amountGhs > 0, outstanding: 0, totalDue: 0 };
  }
  const balance = await getStudentBalanceFromLedger(null, tenantId, studentId, ledgerTermId);
  const outstanding = roundMoney(balance.outstanding);
  const totalDue = roundMoney(balance.totalDue);
  if (amountGhs > outstanding + 0.01) {
    throw new Error(
      `Payment amount GHS ${amountGhs.toFixed(2)} exceeds outstanding balance of GHS ${outstanding.toFixed(2)}`
    );
  }
  return { ok: true, outstanding, totalDue };
}

export type SavePaystackConfigInput = {
  tenantId: number;
  enabled: boolean;
  mode: PaystackMode;
  feeBearer?: PaystackFeeBearer;
  subaccountCode?: string | null;
  payoutAccount?: string | null;
  ownPublicKey?: string | null;
  ownSecretKey?: string | null;
};

export type SuperAdminPaystackTenantInput = {
  tenantId: number;
  superAdminEnabled?: boolean;
  enabled?: boolean;
  mode?: PaystackMode;
  feeBearer?: PaystackFeeBearer;
  subaccountCode?: string | null;
  payoutAccount?: string | null;
};

function mapTenantPaystackRow(row: Record<string, unknown>): TenantPaystackConfig {
  return {
    id: Number(row.id),
    tenant_id: Number(row.tenant_id),
    mode: row.mode === 'own' ? 'own' : 'scholarnerve',
    enabled: Boolean(row.enabled),
    super_admin_enabled: Boolean(row.super_admin_enabled),
    fee_bearer: row.fee_bearer === 'school' ? 'school' : 'parent',
    subaccount_code: row.subaccount_code ? String(row.subaccount_code) : null,
    payout_account: row.payout_account ? String(row.payout_account) : null,
    own_secret_key_encrypted: row.own_secret_key_encrypted ? String(row.own_secret_key_encrypted) : null,
    own_public_key: row.own_public_key ? String(row.own_public_key) : null,
  };
}

const TENANT_PAYSTACK_RETURN = `id, tenant_id, mode, enabled, super_admin_enabled, fee_bearer,
  subaccount_code, payout_account, own_secret_key_encrypted, own_public_key`;

export async function upsertTenantPaystackConfig(input: SavePaystackConfigInput): Promise<TenantPaystackConfig> {
  const existing = await getTenantPaystackConfig(input.tenantId);
  let secretEncrypted = existing?.own_secret_key_encrypted ?? null;

  if (input.mode === 'own' && input.ownSecretKey?.trim()) {
    secretEncrypted = encryptField(input.ownSecretKey.trim());
  }

  const res = await query(
    `INSERT INTO tenant_paystack_config
       (tenant_id, mode, enabled, fee_bearer, subaccount_code, payout_account, own_secret_key_encrypted, own_public_key, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       mode = EXCLUDED.mode,
       enabled = EXCLUDED.enabled,
       fee_bearer = EXCLUDED.fee_bearer,
       subaccount_code = EXCLUDED.subaccount_code,
       payout_account = EXCLUDED.payout_account,
       own_secret_key_encrypted = COALESCE(EXCLUDED.own_secret_key_encrypted, tenant_paystack_config.own_secret_key_encrypted),
       own_public_key = EXCLUDED.own_public_key,
       updated_at = NOW()
     RETURNING ${TENANT_PAYSTACK_RETURN}`,
    [
      input.tenantId,
      input.mode,
      input.enabled,
      input.feeBearer === 'school' ? 'school' : 'parent',
      input.subaccountCode?.trim() || null,
      input.payoutAccount?.trim() || null,
      secretEncrypted,
      input.ownPublicKey?.trim() || null,
    ]
  );

  return mapTenantPaystackRow(res.rows[0]);
}

export async function upsertSuperAdminTenantPaystack(input: SuperAdminPaystackTenantInput): Promise<TenantPaystackConfig> {
  const existing = await getTenantPaystackConfig(input.tenantId);
  const mode = input.mode ?? existing?.mode ?? 'scholarnerve';
  const enabled = input.enabled !== undefined ? input.enabled : (existing?.enabled ?? false);
  const superAdminEnabled =
    input.superAdminEnabled !== undefined ? input.superAdminEnabled : (existing?.super_admin_enabled ?? false);
  const feeBearer = input.feeBearer !== undefined ? input.feeBearer : (existing?.fee_bearer ?? 'parent');
  const subaccountCode = input.subaccountCode !== undefined ? input.subaccountCode?.trim() || null : existing?.subaccount_code ?? null;
  const payoutAccount = input.payoutAccount !== undefined ? input.payoutAccount?.trim() || null : existing?.payout_account ?? null;

  const res = await query(
    `INSERT INTO tenant_paystack_config
       (tenant_id, mode, enabled, super_admin_enabled, fee_bearer, subaccount_code, payout_account, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       mode = EXCLUDED.mode,
       enabled = EXCLUDED.enabled,
       super_admin_enabled = EXCLUDED.super_admin_enabled,
       fee_bearer = EXCLUDED.fee_bearer,
       subaccount_code = EXCLUDED.subaccount_code,
       payout_account = EXCLUDED.payout_account,
       updated_at = NOW()
     RETURNING ${TENANT_PAYSTACK_RETURN}`,
    [input.tenantId, mode, enabled, superAdminEnabled, feeBearer, subaccountCode, payoutAccount]
  );
  return mapTenantPaystackRow(res.rows[0]);
}

export async function listTenantPaystackSummaries(search?: string) {
  const params: unknown[] = [];
  let where = 'WHERE t.archived_at IS NULL';
  if (search?.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (t.name ILIKE $1 OR CAST(t.id AS TEXT) = $2)`;
    params.push(search.trim());
  }
  const res = await query(
    `SELECT t.id AS tenant_id, t.name AS tenant_name,
            COALESCE(pc.enabled, false) AS school_enabled,
            COALESCE(pc.super_admin_enabled, false) AS super_admin_enabled,
            COALESCE(pc.fee_bearer, 'parent') AS fee_bearer,
            COALESCE(pc.mode, 'scholarnerve') AS mode,
            pc.subaccount_code,
            pc.payout_account
       FROM tenants t
       LEFT JOIN tenant_paystack_config pc ON pc.tenant_id = t.id
       ${where}
       ORDER BY t.name ASC
       LIMIT 200`,
    params
  );
  return res.rows.map((row: Record<string, unknown>) => ({
    tenantId: Number(row.tenant_id),
    tenantName: String(row.tenant_name),
    schoolEnabled: Boolean(row.school_enabled),
    superAdminEnabled: Boolean(row.super_admin_enabled),
    effectiveEnabled: Boolean(row.school_enabled) && Boolean(row.super_admin_enabled),
    feeBearer: row.fee_bearer === 'school' ? 'school' : 'parent',
    mode: row.mode === 'own' ? 'own' : 'scholarnerve',
    subaccountCode: row.subaccount_code ? String(row.subaccount_code) : null,
    payoutAccount: row.payout_account ? String(row.payout_account) : null,
  }));
}

export async function publicPaystackConfig(config: TenantPaystackConfig | null) {
  const publicKey = await resolvePaystackPublicKey(config);
  if (!config) {
    return {
      enabled: false,
      schoolEnabled: false,
      superAdminEnabled: false,
      effectiveEnabled: false,
      feeBearer: 'parent' as PaystackFeeBearer,
      mode: 'scholarnerve' as PaystackMode,
      hasOwnKeys: false,
      subaccountCode: null,
      payoutAccount: null,
      ownPublicKey: null,
      publicKey,
    };
  }
  return {
    enabled: config.enabled,
    schoolEnabled: config.enabled,
    superAdminEnabled: config.super_admin_enabled,
    effectiveEnabled: isTenantOnlinePaymentEffective(config),
    feeBearer: config.fee_bearer,
    mode: config.mode,
    hasOwnKeys: Boolean(config.own_secret_key_encrypted && config.own_public_key),
    subaccountCode: config.subaccount_code,
    payoutAccount: config.payout_account,
    ownPublicKey: config.own_public_key,
    publicKey,
  };
}

export async function publicParentPaystackConfig(config: TenantPaystackConfig | null) {
  const full = await publicPaystackConfig(config);
  return {
    enabled: full.effectiveEnabled,
    feeBearer: full.feeBearer,
    mode: full.mode,
    publicKey: full.publicKey,
  };
}

async function assertStudentBelongsToTenant(tenantId: number, studentId: number): Promise<{ name: string; email: string | null }> {
  const res = await query(
    `SELECT s.id, s.first_name, s.last_name, s.guardian_contact
       FROM students s
      WHERE s.id = $1 AND s.tenant_id = $2
      LIMIT 1`,
    [studentId, tenantId]
  );
  if (res.rows.length === 0) throw new Error('Student not found');
  const row = res.rows[0];
  const contact = String(row.guardian_contact || '').trim();
  const email = contact.includes('@') ? contact : null;
  return {
    name: `${row.first_name} ${row.last_name}`.trim(),
    email,
  };
}

function fallbackParentEmail(tenantId: number, studentId: number): string {
  return `payments+${tenantId}+${studentId}@scholarnerve.com`;
}

export async function initializeOnlinePayment(input: {
  tenantId: number;
  studentId: number;
  amountGhs: number;
  email?: string | null;
  callbackUrl?: string;
  initiatedBy?: 'parent' | 'admin';
}): Promise<{
  authorization_url: string;
  access_code: string;
  reference: string;
  amountGhs: number;
  feeGhs: number;
  totalGhs: number;
  publicKey: string | null;
  feeBearer: PaystackFeeBearer;
}> {
  const config = await getTenantPaystackConfig(input.tenantId);
  if (!isTenantOnlinePaymentEffective(config)) {
    throw new Error('Online payments are not enabled for this school');
  }
  if (!config) throw new Error('Online payments are not configured for this school');

  if (config.mode === 'own' && !config.own_secret_key_encrypted) {
    throw new Error('School Paystack secret key is not configured');
  }

  const amountGhs = Number(input.amountGhs);
  if (!Number.isFinite(amountGhs) || amountGhs <= 0) throw new Error('Invalid payment amount');

  await validatePaymentAmountAgainstOutstanding(input.tenantId, input.studentId, amountGhs);

  const student = await assertStudentBelongsToTenant(input.tenantId, input.studentId);
  const email = String(input.email || student.email || fallbackParentEmail(input.tenantId, input.studentId)).trim();

  const amountKobo = ghsToKobo(amountGhs);
  const feeKobo = estimatePaystackFeeKobo(amountKobo);
  const feeBearer = config.fee_bearer === 'school' ? 'school' : 'parent';
  const chargeKobo = feeBearer === 'parent' ? amountKobo : amountKobo;
  const totalKobo = feeBearer === 'parent' ? amountKobo + feeKobo : amountKobo;
  const reference = buildPaymentReference(input.tenantId, input.studentId);

  await query(
    `INSERT INTO payment_transactions
       (tenant_id, student_id, reference, amount_kobo, fee_kobo, total_kobo, status, mode, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8::jsonb)`,
    [
      input.tenantId,
      input.studentId,
      reference,
      amountKobo,
      feeKobo,
      totalKobo,
      config.mode,
      JSON.stringify({ initiatedBy: input.initiatedBy || 'parent', studentName: student.name, feeBearer }),
    ]
  );

  const secretKey = await resolvePaystackSecretKey(config);
  const init = await paystackInitializeTransaction(secretKey, {
    email,
    amountKobo: chargeKobo,
    reference,
    callbackUrl: input.callbackUrl,
    feeBearer,
    metadata: {
      tenant_id: input.tenantId,
      student_id: input.studentId,
      amount_ghs: amountGhs,
      fee_bearer: feeBearer,
      custom_fields: [
        { display_name: 'Student', variable_name: 'student_name', value: student.name },
        { display_name: 'School fee', variable_name: 'fee_amount', value: `GHS ${amountGhs.toFixed(2)}` },
      ],
    },
    subaccountCode: config.mode === 'scholarnerve' ? config.subaccount_code?.trim() || null : null,
  });

  const publicKey = await resolvePaystackPublicKey(config);
  return {
    authorization_url: init.authorization_url,
    access_code: init.access_code,
    reference: init.reference,
    amountGhs,
    feeGhs: koboToGhs(feeKobo),
    totalGhs: koboToGhs(totalKobo),
    publicKey,
    feeBearer,
  };
}

async function generateReceiptNumber(client: pg.PoolClient, tenantId: number): Promise<string> {
  const res = await client.query(
    `INSERT INTO receipt_number_seq (tenant_id, last_number, updated_at)
     VALUES ($1, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (tenant_id) DO UPDATE SET
       last_number = receipt_number_seq.last_number + 1,
       updated_at = CURRENT_TIMESTAMP
     RETURNING last_number`,
    [tenantId]
  );
  const lastNum = res.rows.length > 0 ? parseInt(String(res.rows[0].last_number), 10) : 1;
  return `R${String(lastNum).padStart(8, '0')}`;
}

/** Idempotent success handler — credits ledger once per reference. */
export async function finalizeSuccessfulOnlinePayment(
  tenantId: number,
  reference: string,
  paystackData: {
    id: number;
    channel: string | null;
    paid_at: string | null;
    fees: number;
  }
): Promise<{ alreadyProcessed: boolean }> {
  const txRes = await query(
    `SELECT * FROM payment_transactions WHERE reference = $1 LIMIT 1`,
    [reference]
  );
  if (txRes.rows.length === 0) {
    console.error('[Paystack] Unknown reference:', reference);
    throw new Error('Payment reference not found');
  }

  const tx = txRes.rows[0];
  const parsed = parsePaymentReference(reference);
  if (!parsed || parsed.tenantId !== tenantId || parsed.tenantId !== Number(tx.tenant_id)) {
    console.error('[Paystack] CRITICAL tenant mismatch', { reference, tenantId, txTenant: tx.tenant_id });
    throw new Error('Tenant verification failed');
  }
  if (Number(tx.student_id) !== parsed.studentId) {
    console.error('[Paystack] CRITICAL student mismatch', { reference, parsed, txStudent: tx.student_id });
    throw new Error('Student verification failed');
  }

  if (tx.status === 'success') {
    return { alreadyProcessed: true };
  }

  const amountGhs = koboToGhs(Number(tx.amount_kobo));
  const client = await getClient();
  let receiptNumber: string;
  try {
    receiptNumber = await generateReceiptNumber(client, tenantId);
  } finally {
    client.release();
  }

  const ledgerResult = await recordPaymentWithLedger({
    tenantId,
    studentId: Number(tx.student_id),
    amount: amountGhs,
    paymentDate: (paystackData.paid_at || new Date().toISOString()).slice(0, 10),
    paymentMethod: 'online',
    paymentAccountId: null,
    termLabel: null,
    notes: `Online payment via Paystack — Ref ${reference}`,
    receiptNumber,
    createdByUserId: null,
  });

  const paymentId = Number(ledgerResult.payment.id);

  await query(
    `UPDATE payments SET payment_transaction_id = $1 WHERE id = $2 AND tenant_id = $3`,
    [Number(tx.id), paymentId, tenantId]
  );

  await query(
    `UPDATE payment_transactions
        SET status = 'success',
            paystack_id = $1,
            payment_channel = $2,
            paid_at = COALESCE($3::timestamptz, NOW()),
            fee_kobo = $4,
            updated_at = NOW(),
            metadata = metadata || $5::jsonb
      WHERE id = $6 AND tenant_id = $7`,
    [
      String(paystackData.id),
      paystackData.channel,
      paystackData.paid_at,
      Math.round(Number(paystackData.fees || tx.fee_kobo || 0)),
      JSON.stringify({ payment_id: paymentId, receipt_number: receiptNumber }),
      Number(tx.id),
      tenantId,
    ]
  );

  const studentId = Number(tx.student_id);
  const studentRes = await query(
    `SELECT first_name, last_name FROM students WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [studentId, tenantId]
  );
  const studentName =
    studentRes.rows.length > 0
      ? `${studentRes.rows[0].first_name || ''} ${studentRes.rows[0].last_name || ''}`.trim() || 'Your ward'
      : 'Your ward';

  await sendPushToStudentParents(tenantId, studentId, {
    title: 'Payment successful',
    body: `${studentName}: GHS ${amountGhs.toFixed(2)} was received online. Receipt #${receiptNumber}. Ref ${reference}.`,
    url: `/parent/${tenantId}`,
  }).catch(() => {});

  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: 'online-payment',
      action: 'created',
      at: Date.now(),
    });
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: 'payment',
      action: 'created',
      at: Date.now(),
    });
  } catch {
    /* ignore */
  }

  return { alreadyProcessed: false };
}

export type OnlinePaymentReceipt = {
  id: number;
  amount_paid: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  receipt_number: string;
  reference_number: string;
  notes: string | null;
  term: string;
  receipt_snapshot: unknown;
};

async function fetchOnlinePaymentReceipt(
  tenantId: number,
  reference: string
): Promise<OnlinePaymentReceipt | null> {
  const linked = await query(
    `SELECT p.id,
            COALESCE(p.amount_paid, p.amount) AS amount_paid,
            p.amount,
            p.payment_date,
            p.payment_method,
            p.receipt_number,
            p.notes,
            p.term,
            p.receipt_snapshot
       FROM payments p
       INNER JOIN payment_transactions pt ON pt.id = p.payment_transaction_id
      WHERE pt.reference = $1 AND pt.tenant_id = $2 AND p.tenant_id = $2
      LIMIT 1`,
    [reference, tenantId]
  );
  if (linked.rows.length > 0) {
    const row = linked.rows[0];
    return {
      id: Number(row.id),
      amount_paid: Number(row.amount_paid),
      amount: Number(row.amount ?? row.amount_paid),
      payment_date: String(row.payment_date),
      payment_method: String(row.payment_method || 'online'),
      receipt_number: String(row.receipt_number || ''),
      reference_number: String(row.receipt_number || ''),
      notes: row.notes ? String(row.notes) : null,
      term: String(row.term || ''),
      receipt_snapshot: row.receipt_snapshot ?? null,
    };
  }

  const txRes = await query(
    `SELECT metadata FROM payment_transactions WHERE reference = $1 AND tenant_id = $2 LIMIT 1`,
    [reference, tenantId]
  );
  const paymentId = Number((txRes.rows[0]?.metadata as Record<string, unknown> | undefined)?.payment_id);
  if (!Number.isInteger(paymentId) || paymentId <= 0) return null;

  const pRes = await query(
    `SELECT id,
            COALESCE(amount_paid, amount) AS amount_paid,
            amount,
            payment_date,
            payment_method,
            receipt_number,
            notes,
            term,
            receipt_snapshot
       FROM payments
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1`,
    [paymentId, tenantId]
  );
  if (pRes.rows.length === 0) return null;
  const row = pRes.rows[0];
  return {
    id: Number(row.id),
    amount_paid: Number(row.amount_paid),
    amount: Number(row.amount ?? row.amount_paid),
    payment_date: String(row.payment_date),
    payment_method: String(row.payment_method || 'online'),
    receipt_number: String(row.receipt_number || ''),
    reference_number: String(row.receipt_number || ''),
    notes: row.notes ? String(row.notes) : null,
    term: String(row.term || ''),
    receipt_snapshot: row.receipt_snapshot ?? null,
  };
}

function mapOnlinePaymentReceipt(row: OnlinePaymentReceipt) {
  return {
    id: row.id,
    receipt_number: row.receipt_number,
    reference_number: row.reference_number,
    payment_date: row.payment_date,
    amount_paid: row.amount_paid,
    amount: row.amount,
    payment_method: row.payment_method,
    term: row.term,
    notes: row.notes,
    receipt_snapshot: row.receipt_snapshot,
  };
}

export async function verifyOnlinePayment(reference: string): Promise<{
  status: string;
  reference: string;
  amountGhs: number;
  feeGhs: number;
  totalGhs: number;
  channel: string | null;
  studentName?: string;
  payment?: ReturnType<typeof mapOnlinePaymentReceipt>;
}> {
  const parsed = parsePaymentReference(reference);
  if (!parsed) throw new Error('Invalid payment reference format');

  const config = await getTenantPaystackConfig(parsed.tenantId);
  const secretKey = await resolvePaystackSecretKey(config);

  const txRes = await query(
    `SELECT * FROM payment_transactions WHERE reference = $1 AND tenant_id = $2 LIMIT 1`,
    [reference, parsed.tenantId]
  );
  if (txRes.rows.length === 0) throw new Error('Payment not found');
  const tx = txRes.rows[0];
  const meta = (tx.metadata || {}) as Record<string, unknown>;

  if (tx.status === 'success') {
    const payment = await fetchOnlinePaymentReceipt(parsed.tenantId, reference);
    return {
      status: 'success',
      reference,
      amountGhs: koboToGhs(Number(tx.amount_kobo)),
      feeGhs: koboToGhs(Number(tx.fee_kobo)),
      totalGhs: koboToGhs(Number(tx.total_kobo)),
      channel: tx.payment_channel,
      studentName: typeof meta.studentName === 'string' ? meta.studentName : undefined,
      payment: payment ? mapOnlinePaymentReceipt(payment) : undefined,
    };
  }

  const verified = await paystackVerifyTransaction(secretKey, reference);

  if (verified.status === 'success') {
    await finalizeSuccessfulOnlinePayment(parsed.tenantId, reference, {
      id: verified.id,
      channel: verified.channel,
      paid_at: verified.paid_at,
      fees: verified.fees,
    });
    const payment = await fetchOnlinePaymentReceipt(parsed.tenantId, reference);
    return {
      status: 'success',
      reference,
      amountGhs: koboToGhs(Number(tx.amount_kobo)),
      feeGhs: koboToGhs(Number(verified.fees || tx.fee_kobo)),
      totalGhs: koboToGhs(Number(tx.total_kobo)),
      channel: verified.channel,
      studentName: typeof meta.studentName === 'string' ? meta.studentName : undefined,
      payment: payment ? mapOnlinePaymentReceipt(payment) : undefined,
    };
  }

  const failedStatus = verified.status === 'failed' ? 'failed' : 'abandoned';
  await query(
    `UPDATE payment_transactions SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
    [failedStatus, Number(tx.id), parsed.tenantId]
  );

  return {
    status: failedStatus,
    reference,
    amountGhs: koboToGhs(Number(tx.amount_kobo)),
    feeGhs: koboToGhs(Number(tx.fee_kobo)),
    totalGhs: koboToGhs(Number(tx.total_kobo)),
    channel: verified.channel,
  };
}

export async function handlePaystackWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
  const payload = JSON.parse(rawBody.toString('utf8')) as {
    event?: string;
    data?: { reference?: string; id?: number; channel?: string; paid_at?: string; fees?: number };
  };

  const reference = payload.data?.reference;
  if (!reference) return;

  const parsed = parsePaymentReference(reference);
  if (!parsed) {
    console.error('[Paystack webhook] Invalid reference format:', reference);
    throw new Error('Invalid reference');
  }

  const config = await getTenantPaystackConfig(parsed.tenantId);
  const secretKey = await resolvePaystackSecretKey(config);

  if (!verifyPaystackSignature(rawBody, signature, secretKey)) {
    console.error('[Paystack webhook] Invalid signature for tenant', parsed.tenantId);
    throw new Error('Invalid signature');
  }

  if (payload.event === 'charge.success') {
    await finalizeSuccessfulOnlinePayment(parsed.tenantId, reference, {
      id: Number(payload.data?.id || 0),
      channel: payload.data?.channel || null,
      paid_at: payload.data?.paid_at || null,
      fees: Number(payload.data?.fees || 0),
    });
  }
}

export async function listOnlinePayments(
  tenantId: number,
  filters: { status?: string; search?: string; from?: string; to?: string; limit?: number; offset?: number }
) {
  const params: unknown[] = [tenantId];
  const where: string[] = ['pt.tenant_id = $1'];

  if (filters.status) {
    params.push(filters.status);
    where.push(`pt.status = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    where.push(`pt.created_at >= $${params.length}::date`);
  }
  if (filters.to) {
    params.push(filters.to);
    where.push(`pt.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  if (filters.search?.trim()) {
    params.push(`%${filters.search.trim()}%`);
    where.push(`(s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length} OR pt.reference ILIKE $${params.length})`);
  }

  const whereSql = where.join(' AND ');
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const [rowsRes, summaryRes, countRes] = await Promise.all([
    query(
      `SELECT pt.*, s.first_name, s.last_name, s.admission_number
         FROM payment_transactions pt
         JOIN students s ON s.id = pt.student_id AND s.tenant_id = pt.tenant_id
        WHERE ${whereSql}
        ORDER BY pt.created_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    query(
      `SELECT
         COALESCE(SUM(CASE WHEN pt.status = 'success' THEN pt.amount_kobo ELSE 0 END), 0)::bigint AS total_collected_kobo,
         COUNT(*) FILTER (WHERE pt.status = 'success' AND pt.created_at >= date_trunc('month', NOW()))::int AS month_count,
         MODE() WITHIN GROUP (ORDER BY pt.payment_channel) FILTER (WHERE pt.status = 'success' AND pt.payment_channel IS NOT NULL) AS top_channel
       FROM payment_transactions pt
         JOIN students s ON s.id = pt.student_id AND s.tenant_id = pt.tenant_id
        WHERE ${whereSql}`,
      params
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM payment_transactions pt
         JOIN students s ON s.id = pt.student_id AND s.tenant_id = pt.tenant_id
        WHERE ${whereSql}`,
      params
    ),
  ]);

  return {
    rows: rowsRes.rows,
    total: Number(countRes.rows[0]?.total || 0),
    summary: {
      totalCollectedGhs: koboToGhs(Number(summaryRes.rows[0]?.total_collected_kobo || 0)),
      transactionsThisMonth: Number(summaryRes.rows[0]?.month_count || 0),
      topChannel: summaryRes.rows[0]?.top_channel || null,
    },
  };
}
