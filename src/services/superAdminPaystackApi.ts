import { apiService } from './api';

export type PaystackFeeBearer = 'parent' | 'school';

export interface PlatformPaystackConfig {
  useLiveKeys: boolean;
  testPublicKey: string | null;
  livePublicKey: string | null;
  hasTestSecret: boolean;
  hasLiveSecret: boolean;
  testPublicKeyFromEnv?: boolean;
  testSecretFromEnv?: boolean;
  envTestSecretKey?: string | null;
}

export interface TenantPaystackSummary {
  tenantId: number;
  tenantName: string;
  schoolEnabled: boolean;
  superAdminEnabled: boolean;
  effectiveEnabled: boolean;
  feeBearer: PaystackFeeBearer;
  mode: 'scholarnerve' | 'own';
  subaccountCode: string | null;
  payoutAccount: string | null;
}

export interface SuperAdminTenantPaystackConfig {
  tenantId: number;
  enabled: boolean;
  superAdminEnabled: boolean;
  effectiveEnabled: boolean;
  feeBearer: PaystackFeeBearer;
  mode: 'scholarnerve' | 'own';
  subaccountCode: string | null;
  payoutAccount: string | null;
}

export async function fetchPlatformPaystackConfig(): Promise<PlatformPaystackConfig> {
  const res = await apiService.get<{ config: PlatformPaystackConfig }>('/super-admin/paystack/platform', {
    skipTenant: true,
    skipTenantHeaders: true,
  });
  return res.config;
}

export async function savePlatformPaystackConfig(payload: {
  useLiveKeys: boolean;
  testPublicKey?: string;
  livePublicKey?: string;
  testSecretKey?: string;
  liveSecretKey?: string;
}): Promise<PlatformPaystackConfig> {
  const res = await apiService.put<{ config: PlatformPaystackConfig }>('/super-admin/paystack/platform', payload, {
    skipTenant: true,
    skipTenantHeaders: true,
  });
  return res.config;
}

export async function fetchTenantPaystackSummaries(search?: string): Promise<TenantPaystackSummary[]> {
  const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const res = await apiService.get<{ rows: TenantPaystackSummary[] }>(`/super-admin/paystack/tenants${q}`, {
    skipTenant: true,
    skipTenantHeaders: true,
  });
  return res.rows;
}

export async function fetchSuperAdminTenantPaystack(tenantId: number): Promise<SuperAdminTenantPaystackConfig> {
  const res = await apiService.get<{ config: SuperAdminTenantPaystackConfig }>(
    `/super-admin/paystack/tenants/${tenantId}`,
    { skipTenant: true, skipTenantHeaders: true }
  );
  return res.config;
}

export async function patchSuperAdminTenantPaystack(
  tenantId: number,
  payload: Partial<{
    superAdminEnabled: boolean;
    enabled: boolean;
    feeBearer: PaystackFeeBearer;
    mode: 'scholarnerve' | 'own';
    subaccountCode: string;
    payoutAccount: string;
  }>
): Promise<SuperAdminTenantPaystackConfig> {
  const res = await apiService.patch<{ config: SuperAdminTenantPaystackConfig }>(
    `/super-admin/paystack/tenants/${tenantId}`,
    payload,
    { skipTenant: true, skipTenantHeaders: true }
  );
  return res.config;
}
