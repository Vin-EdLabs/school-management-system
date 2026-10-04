import { apiService } from './api';

export type SmsPackage = {
  id: string;
  name: string;
  credits: number;
  priceGhs: number;
  badge?: string;
  description?: string;
  popular?: boolean;
  isActive?: boolean;
  sortOrder?: number;
};

export type SmsNotificationToggles = {
  payments: boolean;
  attendance: boolean;
  grades: boolean;
  broadcasts: boolean;
  exeats: boolean;
  birthdays: boolean;
};

export type TenantSmsWallet = {
  balance: number;
  senderId: string;
  senderIdStatus: 'default' | 'pending' | 'approved' | 'rejected';
  enabled: boolean;
  toggles: SmsNotificationToggles;
  gatewayConfigured: boolean;
};

export type SmsLogRow = {
  id: number;
  recipient_phone: string;
  recipient_name: string | null;
  recipient_type: string;
  event_type: string;
  message: string;
  segment_count: number;
  credits_deducted: number;
  status: 'sent' | 'failed' | 'delivered';
  error_message: string | null;
  created_at: string;
};

export type SmsTopupRow = {
  id: number;
  package_name: string;
  amount_ghs: number;
  credits_purchased: number;
  paystack_reference: string;
  status: 'pending' | 'successful' | 'failed';
  payment_method: string;
  paid_at: string | null;
  created_at: string;
};

export type SenderIdRequestRow = {
  id: number;
  tenant_id: number;
  requested_sender_id: string;
  purpose: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  school_name?: string;
  requester_name?: string;
};

export type SmsWalletResponse = {
  wallet: TenantSmsWallet;
  packages: SmsPackage[];
  recentLogs: SmsLogRow[];
  recentTopups: SmsTopupRow[];
  pendingSenderIdRequest: SenderIdRequestRow | null;
  approvedSenderIdRequest?: (SenderIdRequestRow & { updated_at?: string }) | null;
};

export type SmsLogsResponse = {
  logs: SmsLogRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function fetchSmsWallet(): Promise<SmsWalletResponse> {
  return apiService.get<SmsWalletResponse>('/sms/wallet');
}

export async function updateSmsPreferences(payload: {
  enabled?: boolean;
  toggles?: Partial<SmsNotificationToggles>;
}): Promise<{ success: boolean; wallet: TenantSmsWallet }> {
  return apiService.put<{ success: boolean; wallet: TenantSmsWallet }>('/sms/preferences', payload);
}

export async function requestSenderId(payload: {
  senderId: string;
  purpose?: string;
}): Promise<{ success: boolean; message: string; requestedSenderId: string }> {
  return apiService.post<{ success: boolean; message: string; requestedSenderId: string }>(
    '/sms/sender-id/request',
    payload
  );
}

export async function initializeSmsTopup(payload: {
  packageId: string;
  callbackUrl?: string;
}): Promise<{
  authorizationUrl: string;
  reference: string;
  accessCode: string;
  packageName: string;
  credits: number;
  priceGhs: number;
}> {
  return apiService.post('/sms/topup/initialize', payload);
}

export async function verifySmsTopup(reference: string): Promise<{
  success: boolean;
  message: string;
  newBalance: number;
  creditsAdded: number;
}> {
  return apiService.get(`/sms/topup/verify?reference=${encodeURIComponent(reference)}`);
}

export async function sendTestSms(payload: {
  phone: string;
  message?: string;
  skipSenderIdApprovalCheck?: boolean;
}): Promise<{
  success: boolean;
  message: string;
  senderId?: string;
  creditsDeducted: number;
  remainingBalance: number;
  gatewayStatus?: string;
  gatewayData?: any;
}> {
  return apiService.post('/sms/test', payload);
}

export async function fetchSmsLogs(params: {
  page?: number;
  limit?: number;
  eventType?: string;
  status?: string;
  search?: string;
}): Promise<SmsLogsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.eventType) query.set('eventType', params.eventType);
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);

  return apiService.get<SmsLogsResponse>(`/sms/logs?${query.toString()}`);
}

// ---- Super-Admin APIs ----

export async function fetchMasterArkeselBalance(): Promise<{
  success: boolean;
  balance?: number;
  currency?: string;
  error?: string;
}> {
  return apiService.get('/sms/admin/master-balance');
}

export async function adminCreditTenantSms(payload: {
  tenantId: number;
  credits: number;
  reason?: string;
}): Promise<{ success: boolean; previousBalance: number; newBalance: number }> {
  return apiService.post('/sms/admin/credit', payload);
}

export async function fetchAllSenderIdRequests(): Promise<SenderIdRequestRow[]> {
  return apiService.get<SenderIdRequestRow[]>('/sms/admin/sender-id-requests');
}

export async function updateSenderIdRequestStatus(
  requestId: number,
  payload: { status: 'approved' | 'rejected'; rejectionReason?: string }
): Promise<{ success: boolean; message: string }> {
  return apiService.put(`/sms/admin/sender-id-requests/${requestId}`, payload);
}

export async function fetchAdminSmsPackages(): Promise<{ packages: SmsPackage[] }> {
  return apiService.get('/sms/admin/packages');
}

export async function saveAdminSmsPackages(packages: SmsPackage[]): Promise<{ success: boolean; packages: SmsPackage[] }> {
  return apiService.put('/sms/admin/packages', { packages });
}

export async function deleteAdminSmsPackage(packageId: string): Promise<{ success: boolean }> {
  return apiService.delete(`/sms/admin/packages/${packageId}`);
}
