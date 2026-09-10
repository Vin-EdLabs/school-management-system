import { apiService } from './api';

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

export type InvoiceBranding = {
  companyName: string;
  tagline: string;
  address: string;
  email: string;
  phone: string;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  momoNumber: string | null;
  defaultNotes: string | null;
  logoUrl: string | null;
};

export type SchoolBillingInfo = {
  name: string;
  address: string | null;
  contact: string | null;
  email: string | null;
};

// ---- Super admin ----

export async function fetchSchoolBillingInfo(tenantId: number): Promise<SchoolBillingInfo> {
  return apiService.get<SchoolBillingInfo>(`/super-admin/billing/tenants/${tenantId}/school-info`);
}

export async function fetchInvoiceBrandingAdmin(): Promise<InvoiceBranding> {
  return apiService.get<InvoiceBranding>(`/super-admin/billing/branding`);
}

export async function saveInvoiceBranding(input: InvoiceBranding): Promise<InvoiceBranding> {
  return apiService.put<InvoiceBranding>(`/super-admin/billing/branding`, input);
}

export async function fetchActiveStudentCount(tenantId: number): Promise<number> {
  const data = await apiService.get<{ activeStudentCount: number }>(
    `/super-admin/billing/tenants/${tenantId}/active-student-count`
  );
  return data.activeStudentCount;
}

export async function fetchBillingConfig(tenantId: number): Promise<PlatformBillingConfig | null> {
  return apiService.get<PlatformBillingConfig | null>(`/super-admin/billing/tenants/${tenantId}/config`);
}

export async function saveBillingConfig(
  tenantId: number,
  input: {
    billingFrequency: BillingFrequency;
    pricePerStudentTermly: number;
    pricePerStudentYearly: number;
    pricePerStudentMonthly: number;
  }
): Promise<PlatformBillingConfig> {
  return apiService.put<PlatformBillingConfig>(`/super-admin/billing/tenants/${tenantId}/config`, input);
}

export async function fetchTenantInvoices(tenantId: number): Promise<PlatformInvoice[]> {
  return apiService.get<PlatformInvoice[]>(`/super-admin/billing/tenants/${tenantId}/invoices`);
}

export async function postTenantInvoice(
  tenantId: number,
  input: { finalAmount?: number | null; note?: string | null; dueDate?: string | null }
): Promise<PlatformInvoice> {
  return apiService.post<PlatformInvoice>(`/super-admin/billing/tenants/${tenantId}/invoices`, input);
}

export async function markInvoicePaid(tenantId: number, invoiceId: number): Promise<PlatformInvoice> {
  return apiService.post<PlatformInvoice>(
    `/super-admin/billing/tenants/${tenantId}/invoices/${invoiceId}/mark-paid`,
    {}
  );
}

// ---- School side ----

export async function fetchCurrentBilling(): Promise<{
  invoice: PlatformInvoice | null;
  billingFrequency: BillingFrequency | null;
}> {
  return apiService.get(`/billing/current`);
}

export async function fetchBillingHistory(): Promise<PlatformInvoice[]> {
  return apiService.get<PlatformInvoice[]>(`/billing/history`);
}

export async function initializeInvoicePayment(
  invoiceId: number,
  callbackUrl?: string
): Promise<{ authorizationUrl: string; reference: string; accessCode: string }> {
  return apiService.post(`/billing/invoices/${invoiceId}/pay/initialize`, { callbackUrl });
}

export async function verifyInvoicePayment(reference: string): Promise<PlatformInvoice> {
  return apiService.get<PlatformInvoice>(`/billing/pay/verify?reference=${encodeURIComponent(reference)}`);
}

export async function fetchInvoiceBranding(): Promise<InvoiceBranding> {
  return apiService.get<InvoiceBranding>(`/billing/branding`);
}
