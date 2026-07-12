import { apiService } from './api';
import { detectTenantSlugFromHost } from '../utils/tenantHost';

const API = import.meta.env.VITE_API_BASE_URL || '';

async function parentFetch<T>(path: string, token: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  headers['Authorization'] = `Bearer ${token}`;
  const slug = detectTenantSlugFromHost();
  if (slug) headers['X-Tenant-Slug'] = slug;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
  return data as T;
}

export interface CheckinStudent {
  id: number;
  first_name: string;
  last_name: string;
  student_id: string;
  admission_number: string;
  class_name?: string;
  class_id?: number;
  is_checkin_enabled?: boolean;
  last_action?: 'check_in' | 'check_out' | null;
  last_action_time?: string | null;
  current_status?: 'on_campus' | 'off_campus' | 'no_record';
}

export interface CheckinRecord {
  id: string;
  action: 'check_in' | 'check_out';
  action_time: string;
  performed_by_type: 'parent' | 'staff';
  method: 'qr_scan' | 'manual';
  notes?: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
  student_id?: string;
  admission_number?: string;
  class_name?: string;
}

export interface PaginatedHistory {
  items: CheckinRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface QrContent {
  checkInUrl: string;
  checkOutUrl: string;
  baseUrl: string;
}

export const checkinService = {
  async processParentCheckin(action: 'check_in' | 'check_out', studentIds: number[] | undefined, parentToken: string) {
    return parentFetch('/student-checkins/process', parentToken, {
      method: 'POST',
      body: JSON.stringify({ action, studentIds }),
    });
  },

  async manualCheckin(studentId: number, action: 'check_in' | 'check_out', notes?: string) {
    return apiService.post('/student-checkins/manual', { studentId, action, notes });
  },

  async getStatus(classId?: string): Promise<CheckinStudent[]> {
    const params = classId ? `?classId=${classId}` : '';
    return apiService.get(`/student-checkins/status${params}`);
  },

  async getStudentHistory(studentId: string): Promise<CheckinRecord[]> {
    return apiService.get(`/student-checkins/student/${studentId}`);
  },

  async getHistory(params?: { page?: number; limit?: number; date?: string; classId?: string }): Promise<PaginatedHistory> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.date) query.set('date', params.date);
    if (params?.classId) query.set('classId', params.classId);
    const qs = query.toString();
    return apiService.get(`/student-checkins/history${qs ? `?${qs}` : ''}`);
  },

  async getMyStatus(parentToken: string): Promise<CheckinStudent[]> {
    return parentFetch('/student-checkins/my-status', parentToken);
  },

  async toggleOptIn(enabled: boolean, parentToken: string, studentId?: number) {
    return parentFetch('/student-checkins/opt-in', parentToken, {
      method: 'PATCH',
      body: JSON.stringify({ enabled, studentId }),
    });
  },

  async getQrContent(): Promise<QrContent> {
    return apiService.get('/student-checkins/qr-content');
  },

  // ── Public (no auth) methods ──────────────────────────────────────────────

  /** Resolve tenant slug: host subdomain → URL param → localStorage fallback */
  resolveTenantSlug(): string {
    const fromHost = detectTenantSlugFromHost();
    if (fromHost) return fromHost;
    try { return localStorage.getItem('checkin_tenant_slug') || ''; } catch { return ''; }
  },

  async lookupStudent(admissionNumber: string): Promise<LookupResult> {
    const slug = this.resolveTenantSlug();
    const headers: Record<string, string> = {};
    if (slug) headers['X-Tenant-Slug'] = slug;
    const res = await fetch(`${API}/public-checkins/lookup/${encodeURIComponent(admissionNumber)}`, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lookup failed');
    return data as LookupResult;
  },

  async publicProcessCheckin(action: 'check_in' | 'check_out', admissionNumber: string): Promise<PublicProcessResult> {
    const slug = this.resolveTenantSlug();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (slug) headers['X-Tenant-Slug'] = slug;
    const res = await fetch(`${API}/public-checkins/process`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, admissionNumber }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data as PublicProcessResult;
  },
};

export interface LookupResult {
  student: {
    id: number;
    firstName: string;
    lastName: string;
    studentId: string;
    admissionNumber: string;
    className: string;
    isCheckinEnabled: boolean;
    lastAction: string | null;
    lastActionTime: string | null;
  };
  siblings: Array<{
    id: number;
    firstName: string;
    lastName: string;
    studentId: string;
    admissionNumber: string;
  }>;
}

export interface PublicProcessResult {
  message: string;
  student: {
    id: number;
    firstName: string;
    lastName: string;
  };
}
