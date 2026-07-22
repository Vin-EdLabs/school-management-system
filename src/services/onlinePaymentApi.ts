import { apiService } from './api';

export type PaystackMode = 'scholarnerve' | 'own';
export type PaystackFeeBearer = 'parent' | 'school';
export type OnlinePaymentStatus = 'pending' | 'success' | 'failed' | 'abandoned';

export interface PaystackConfigPublic {
  enabled: boolean;
  schoolEnabled?: boolean;
  superAdminEnabled?: boolean;
  effectiveEnabled?: boolean;
  feeBearer?: PaystackFeeBearer;
  mode: PaystackMode;
  hasOwnKeys: boolean;
  subaccountCode: string | null;
  payoutAccount: string | null;
  ownPublicKey: string | null;
  publicKey: string | null;
}

export interface OnlinePaymentRow {
  id: number;
  reference: string;
  studentName: string;
  admission_number?: string;
  amountGhs: number;
  feeGhs: number;
  totalGhs: number;
  payment_channel: string | null;
  status: OnlinePaymentStatus;
  created_at: string;
  paid_at: string | null;
}

export interface InitializePaymentResult {
  authorization_url: string;
  access_code: string;
  reference: string;
  amountGhs: number;
  feeGhs: number;
  totalGhs: number;
  publicKey: string | null;
}

export interface OnlinePaymentReceipt {
  id: number;
  receipt_number: string;
  reference_number: string;
  payment_date: string;
  amount_paid: number;
  amount: number;
  payment_method: string;
  term: string;
  notes: string | null;
  receipt_snapshot: unknown;
}

export async function fetchPaystackConfig(): Promise<PaystackConfigPublic> {
  const res = await apiService.get<{ config: PaystackConfigPublic }>('/payments/config');
  return res.config;
}

export async function savePaystackConfig(payload: {
  enabled: boolean;
  mode: PaystackMode;
  feeBearer?: PaystackFeeBearer;
  subaccountCode?: string;
  payoutAccount?: string;
  ownPublicKey?: string;
  ownSecretKey?: string;
}): Promise<PaystackConfigPublic> {
  const res = await apiService.post<{ config: PaystackConfigPublic }>('/payments/config', payload);
  return res.config;
}

export async function fetchOnlinePayments(params: {
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  rows: OnlinePaymentRow[];
  total: number;
  summary: { totalCollectedGhs: number; transactionsThisMonth: number; topChannel: string | null };
}> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiService.get(`/payments/transactions${suffix}`);
}

const API = import.meta.env.VITE_API_URL || '/api';

export async function fetchParentOnlineConfig(token: string): Promise<PaystackConfigPublic> {
  const res = await fetch(`${API}/parent/payments/online-config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to load online payments');
  return json.config;
}

export async function initializeParentPayment(
  token: string,
  payload: { studentId: number; amount: number; email?: string; callbackUrl?: string }
): Promise<InitializePaymentResult> {
  const res = await fetch(`${API}/parent/payments/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: payload.studentId,
      amount: payload.amount,
      email: payload.email,
      callbackUrl: payload.callbackUrl,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Could not start payment');
  return json;
}

export async function verifyParentPayment(token: string, reference: string): Promise<{
  status: string;
  reference: string;
  amountGhs: number;
  feeGhs: number;
  totalGhs: number;
  channel: string | null;
  studentName?: string;
  payment?: OnlinePaymentReceipt;
}> {
  const res = await fetch(`${API}/parent/payments/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Verification failed');
  return json;
}
