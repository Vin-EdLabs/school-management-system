import crypto from 'crypto';
import { decryptField } from '../utils/fieldEncryption.js';
import { query } from '../db/connection.js';
import { resolvePlatformPaystackKeys } from './platformPaystackService.js';

const PAYSTACK_BASE = 'https://api.paystack.co';

export type PaystackMode = 'scholarnerve' | 'own';
export type PaystackFeeBearer = 'parent' | 'school';

export type TenantPaystackConfig = {
  id: number;
  tenant_id: number;
  mode: PaystackMode;
  enabled: boolean;
  super_admin_enabled: boolean;
  fee_bearer: PaystackFeeBearer;
  subaccount_code: string | null;
  payout_account: string | null;
  own_secret_key_encrypted: string | null;
  own_public_key: string | null;
};

export type ParsedPaymentReference = {
  tenantId: number;
  studentId: number;
  timestamp: number;
};

/** SN-{tenant_id}-{student_id}-{timestamp} */
export function buildPaymentReference(tenantId: number, studentId: number): string {
  return `SN-${tenantId}-${studentId}-${Date.now()}`;
}

export function parsePaymentReference(reference: string): ParsedPaymentReference | null {
  const match = String(reference || '').trim().match(/^SN-(\d+)-(\d+)-(\d+)$/);
  if (!match) return null;
  const tenantId = Number(match[1]);
  const studentId = Number(match[2]);
  const timestamp = Number(match[3]);
  if (!Number.isInteger(tenantId) || tenantId <= 0) return null;
  if (!Number.isInteger(studentId) || studentId <= 0) return null;
  if (!Number.isInteger(timestamp) || timestamp <= 0) return null;
  return { tenantId, studentId, timestamp };
}

export type ParsedPlatformBillingReference = {
  tenantId: number;
  invoiceId: number;
  timestamp: number;
};

/** SNBILL-{tenant_id}-{invoice_id}-{timestamp} — platform billing (school paying ScholarNerve), never a school-fee reference. */
export function buildPlatformBillingReference(tenantId: number, invoiceId: number): string {
  return `SNBILL-${tenantId}-${invoiceId}-${Date.now()}`;
}

export function parsePlatformBillingReference(reference: string): ParsedPlatformBillingReference | null {
  const match = String(reference || '').trim().match(/^SNBILL-(\d+)-(\d+)-(\d+)$/);
  if (!match) return null;
  const tenantId = Number(match[1]);
  const invoiceId = Number(match[2]);
  const timestamp = Number(match[3]);
  if (!Number.isInteger(tenantId) || tenantId <= 0) return null;
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) return null;
  if (!Number.isInteger(timestamp) || timestamp <= 0) return null;
  return { tenantId, invoiceId, timestamp };
}

export function verifyPaystackSignature(rawBody: Buffer | string, signature: string, secretKey: string): boolean {
  const hash = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(String(signature || '')));
  } catch {
    return false;
  }
}

export async function getTenantPaystackConfig(tenantId: number): Promise<TenantPaystackConfig | null> {
  const res = await query(
    `SELECT id, tenant_id, mode, enabled, super_admin_enabled, fee_bearer,
            subaccount_code, payout_account, own_secret_key_encrypted, own_public_key
       FROM tenant_paystack_config
      WHERE tenant_id = $1
      LIMIT 1`,
    [tenantId]
  );
  const row = res.rows[0] as TenantPaystackConfig | undefined;
  if (!row) return null;
  return {
    ...row,
    fee_bearer: row.fee_bearer === 'school' ? 'school' : 'parent',
    super_admin_enabled: Boolean(row.super_admin_enabled),
  };
}

export function isTenantOnlinePaymentEffective(config: TenantPaystackConfig | null): boolean {
  if (!config) return false;
  return Boolean(config.enabled && config.super_admin_enabled);
}

export async function resolvePaystackSecretKey(config: TenantPaystackConfig | null): Promise<string> {
  if (config?.mode === 'own') {
    if (!config.own_secret_key_encrypted) {
      throw new Error('School Paystack secret key is not configured');
    }
    return decryptField(config.own_secret_key_encrypted);
  }
  const platform = await resolvePlatformPaystackKeys();
  if (platform.secretKey) return platform.secretKey;
  throw new Error('ScholarNerve Paystack is not configured on the platform');
}

export async function resolvePaystackPublicKey(config: TenantPaystackConfig | null): Promise<string | null> {
  if (config?.mode === 'own') return config.own_public_key || null;
  const platform = await resolvePlatformPaystackKeys();
  return platform.publicKey;
}

type PaystackInitPayload = {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  subaccountCode?: string | null;
  feeBearer: PaystackFeeBearer;
};

export async function paystackInitializeTransaction(
  secretKey: string,
  payload: PaystackInitPayload
): Promise<{ authorization_url: string; access_code: string; reference: string }> {
  const body: Record<string, unknown> = {
    email: payload.email,
    amount: payload.amountKobo,
    reference: payload.reference,
    currency: 'GHS',
    bearer: payload.feeBearer === 'school' ? 'account' : 'customer',
    callback_url: payload.callbackUrl,
    metadata: payload.metadata || {},
  };
  if (payload.subaccountCode) {
    body.subaccount = payload.subaccountCode;
    if (payload.feeBearer === 'school') {
      body.bearer = 'subaccount';
    }
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  };

  if (!res.ok || !json.status || !json.data) {
    throw new Error(json.message || 'Paystack initialization failed');
  }

  return json.data;
}

export async function paystackVerifyTransaction(
  secretKey: string,
  reference: string
): Promise<{
  id: number;
  status: string;
  amount: number;
  fees: number;
  channel: string | null;
  paid_at: string | null;
  gateway_response: string;
}> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: {
      id: number;
      status: string;
      amount: number;
      fees: number;
      channel: string | null;
      paid_at: string | null;
      gateway_response: string;
    };
  };

  if (!res.ok || !json.status || !json.data) {
    throw new Error(json.message || 'Paystack verification failed');
  }

  return json.data;
}

/** Estimate Paystack fee for display (1.95%). Parent pays this on top when bearer=customer. */
export function estimatePaystackFeeKobo(amountKobo: number): number {
  return Math.max(Math.ceil(amountKobo * 0.0195), 0);
}

export function ghsToKobo(amountGhs: number): number {
  return Math.round(Number(amountGhs) * 100);
}

export function koboToGhs(amountKobo: number): number {
  return Math.round(Number(amountKobo)) / 100;
}
