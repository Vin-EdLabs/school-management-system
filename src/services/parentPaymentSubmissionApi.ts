import { detectTenantSlugFromHost } from '@/utils/tenantHost';

function resolveApiBase(): string {
  const env = import.meta.env.VITE_API_URL as string | undefined;
  if (env?.trim()) {
    const trimmed = env.trim().replace(/\/$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:3001/api';
}

const API = resolveApiBase();

function authHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const slug = detectTenantSlugFromHost();
  if (slug) headers['X-Tenant-Slug'] = slug;
  return headers;
}

export interface SchoolPaymentDetails {
  mtnMomoNumber: string;
  mtnMomoName: string;
  vodafoneCashNumber: string;
  vodafoneCashName: string;
  airteltigoNumber: string;
  airteltigoName: string;
  merchantId: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  paymentInstructions: string;
}

export interface PaymentSubmission {
  id: number;
  studentId: number;
  amountClaimed: number;
  networkUsed: string;
  transactionReference?: string | null;
  screenshotUrl: string;
  status: 'pending' | 'reviewed' | 'rejected';
  submittedAt: string;
  studentName?: string;
  notes?: string | null;
}

export async function fetchParentPaymentDetails(token: string): Promise<SchoolPaymentDetails> {
  const res = await fetch(`${API}/payment-submissions/payment-details`, {
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load payment details');
  return data;
}

export async function fetchMyPaymentSubmissions(token: string): Promise<PaymentSubmission[]> {
  const res = await fetch(`${API}/payment-submissions/my`, {
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load submissions');
  return data;
}

export async function submitPaymentProof(token: string, formData: FormData): Promise<PaymentSubmission> {
  const res = await fetch(`${API}/payment-submissions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Submission failed');
  return data;
}
