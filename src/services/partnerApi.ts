/**
 * Partner Network API client — deliberately separate from apiService so partner
 * sessions never mix with school staff or parent auth (different token, no
 * tenant headers).
 */

import { getPartnersPortalUrl } from '@/utils/partnersHost';

const PARTNER_TOKEN_KEY = 'snPartnerToken';
/** Canonical realm — same saved login on partners.localhost and partners.scholarnerve.com */
export const PARTNER_LOGIN_REALM = 'partners.scholarnerve.com';
const PARTNER_SAVED_LOGIN_KEY = `snPartnerSavedLogin::${PARTNER_LOGIN_REALM}`;
const LEGACY_PARTNER_SAVED_LOGIN_KEY = 'snPartnerSavedLogin';

export type PartnerSavedLogin = {
  identifier: string;
  password: string;
};

function resolveBase(): string {
  const host = window.location.hostname;
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.lvh.me')
  ) {
    return '/api';
  }
  if (host === 'scholarnerve.com' || host.endsWith('.scholarnerve.com') || host.endsWith('.onrender.com')) {
    return `${window.location.origin}/api`;
  }
  const envBase = String(import.meta.env?.VITE_API_BASE_URL || '').trim();
  return envBase ? envBase.replace(/\/$/, '') : 'http://localhost:3001/api';
}

export function getPartnerToken(): string | null {
  return localStorage.getItem(PARTNER_TOKEN_KEY);
}

export function setPartnerToken(token: string | null): void {
  if (token) {
    localStorage.setItem(PARTNER_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(PARTNER_TOKEN_KEY);
  }
}

export class PartnerApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  opts?: { auth?: boolean }
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.auth !== false) {
    const token = getPartnerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutMs = 20_000;
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${resolveBase()}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new PartnerApiError('Request timed out — is the server running?', 0);
    }
    throw new PartnerApiError('Network error — check your connection and that the server is running.', 0);
  } finally {
    window.clearTimeout(timer);
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new PartnerApiError(
      String(payload?.error || `Request failed (${response.status})`),
      response.status,
      payload?.fields
    );
  }
  return payload as T;
}

export const partnerApi = {
  get: <T>(endpoint: string) => request<T>('GET', endpoint),
  getPublic: <T>(endpoint: string) => request<T>('GET', endpoint, undefined, { auth: false }),
  post: <T>(endpoint: string, body?: unknown) => request<T>('POST', endpoint, body),
  put: <T>(endpoint: string, body?: unknown) => request<T>('PUT', endpoint, body),
  postPublic: <T>(endpoint: string, body?: unknown) =>
    request<T>('POST', endpoint, body, { auth: false }),
};

// ---------------------------------------------------------------------------
// Shared partner types
// ---------------------------------------------------------------------------

export type PartnerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type PartnerTier = 'partner' | 'senior_partner' | 'team_leader' | 'regional_director';

export interface PartnerProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp: string | null;
  region: string;
  town: string | null;
  occupation: string | null;
  momoNumber: string;
  momoNetwork: string;
  schoolsTarget: string | null;
  status: PartnerStatus;
  partnerId: string | null;
  tier: PartnerTier;
  profilePhotoUrl?: string | null;
  suspensionNote?: string | null;
  createdAt: string;
}

export interface PartnerStats {
  totalSchools: number;
  activeSchools: number;
  thisMonthEarnings: number;
  lastMonthEarnings?: number;
  totalEarned: number;
  totalAll: number;
  pendingPayout: number;
  unreadNotifications: number;
  unreadSupportMessages?: number;
}

export interface PartnerActivityItem {
  id: string;
  kind: 'commission' | 'lead' | 'notification';
  title: string;
  subtitle: string;
  right: string;
  tone: 'green' | 'orange' | 'blue';
  createdAt: string;
}

export interface PartnerLead {
  id: number;
  school_name: string;
  proprietor_name: string | null;
  phone: string | null;
  region: string | null;
  student_count: string | null;
  demo_date: string | null;
  demo_meeting_url: string | null;
  status: 'new' | 'contacted' | 'demo_booked' | 'converted' | 'dead';
  plan_amount: string | null;
  monthly_commission: string | number | null;
  created_at: string;
}

export interface PartnerCommission {
  id: number;
  school_name: string | null;
  month: number;
  year: number;
  plan_amount: string;
  commission_rate: string;
  commission_amount: string;
  status: 'pending' | 'paid';
  paid_at: string | null;
  momo_reference: string | null;
}

export interface PartnerVideo {
  id: number;
  youtube_url: string;
  title: string;
  description: string | null;
  watched: boolean;
  created_at: string;
}

export interface PartnerNotification {
  id: number;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface PartnerSupportMessage {
  id: number;
  sender_role: 'partner' | 'super-admin';
  sender_username: string | null;
  message: string;
  is_from_superadmin: boolean;
  read_at: string | null;
  created_at: string;
}

export const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
  'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
  'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
];

export const MOMO_NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'];

export const HEARD_FROM_OPTIONS = [
  { value: 'social_media', label: 'Social Media' },
  { value: 'friends', label: 'Friends' },
  { value: 'other', label: 'Other' },
] as const;

export const PARTNER_GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const;

export const TIER_META: Record<PartnerTier, { label: string; range: string; min: number; max: number | null }> = {
  partner: { label: 'Partner', range: '1–2 active schools', min: 1, max: 2 },
  senior_partner: { label: 'Senior Partner', range: '3–4 active schools', min: 3, max: 4 },
  team_leader: { label: 'Team Leader', range: '5–9 active schools', min: 5, max: 9 },
  regional_director: { label: 'Regional Director', range: '10+ active schools', min: 10, max: null },
};

export function formatGhs(amount: number | string | null | undefined): string {
  const n = Number(amount || 0);
  return `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function youtubeId(url: string): string | null {
  const match = String(url || '').match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  return match ? match[1] : null;
}

export function youtubeThumb(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function savePartnerLoginCredentials(identifier: string, password: string): void {
  try {
    localStorage.setItem(
      PARTNER_SAVED_LOGIN_KEY,
      JSON.stringify({ identifier, password, realm: PARTNER_LOGIN_REALM }),
    );
    localStorage.removeItem(LEGACY_PARTNER_SAVED_LOGIN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function readPartnerLoginCredentials(): PartnerSavedLogin | null {
  try {
    const raw =
      localStorage.getItem(PARTNER_SAVED_LOGIN_KEY) ||
      localStorage.getItem(LEGACY_PARTNER_SAVED_LOGIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PartnerSavedLogin & { realm?: string };
    if (!parsed?.identifier) return null;
    return { identifier: parsed.identifier, password: parsed.password || '' };
  } catch {
    return null;
  }
}

export function parsePartnerLoginPrefillFromHash(): PartnerSavedLogin | null {
  const hash = window.location.hash.replace(/^#/, '');
  const match = hash.match(/(?:^|&)prefill=([^&]+)/);
  if (!match) return null;
  try {
    const data = JSON.parse(atob(decodeURIComponent(match[1]))) as { i?: string; p?: string };
    if (!data.i) return null;
    return { identifier: data.i, password: data.p || '' };
  } catch {
    return null;
  }
}

export function clearPartnerLoginPrefillHash(): void {
  if (!window.location.hash.includes('prefill=')) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function buildPartnerLoginPrefillUrl(identifier: string, password: string): string {
  const payload = btoa(JSON.stringify({ i: identifier, p: password }));
  const loginPath = `/login#prefill=${encodeURIComponent(payload)}&registered=1`;
  return `${getPartnersPortalUrl()}/open?to=${encodeURIComponent(loginPath)}`;
}
