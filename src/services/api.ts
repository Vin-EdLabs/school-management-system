
// API service for backend integration
import { detectTenantSlugFromHost } from '../utils/tenantHost';
import { shouldTrackInactivity } from '../utils/inactivityTracker';

async function readResponseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Could not read server response. You may be offline, or the server returned an invalid page.');
  }
}

function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function hashRequestKey(input: string | undefined): string {
  const safe = input ?? '';
  let hash = 0;
  for (let i = 0; i < safe.length; i += 1) {
    hash = (hash * 31 + safe.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function formDataFingerprint(formData: FormData): string {
  const parts: string[] = [];
  formData.forEach((value, key) => {
    if (value instanceof File) {
      parts.push(`${key}=file:${value.name}:${value.size}:${value.type}:${value.lastModified}`);
    } else {
      parts.push(`${key}=${String(value)}`);
    }
  });
  return parts.sort().join('&');
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/api\/?$/, '/api');
  }
  const normalized = trimmed.replace(/^\/*/, '').replace(/\/$/, '');
  return `/${normalized}`.replace(/\/api\/?$/, '/api');
}

function resolveApiBaseUrl(): string {
  const envBase = typeof import.meta !== 'undefined' ? String(import.meta.env?.VITE_API_BASE_URL || '').trim() : '';
  if (envBase) {
    return normalizeBaseUrl(envBase);
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'scholarnerve.com' || host.endsWith('.scholarnerve.com')) {
      return `${window.location.origin}/api`;
    }
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.lvh.me')) {
      return '/api';
    }
  }

  return 'http://localhost:3001/api';
}

function apiErrorMessage(payload: Record<string, unknown> | null, status: number): string {
  if (payload?.code === 'NO_ACTIVE_TERM') {
    return 'Please set an active academic term in Settings before continuing.';
  }
  let msg = String(payload?.message || payload?.error || `Request failed (${status})`);
  if (payload?.hint) msg += ` ${String(payload.hint)}`;
  if (payload?.detail) msg += ` (${String(payload.detail)})`;
  return msg;
}

function throwApiError(payload: Record<string, unknown> | null, status: number): never {
  const err = new Error(apiErrorMessage(payload, status)) as Error & { code?: string; status?: number; apiError?: string };
  if (payload?.code) err.code = String(payload.code);
  if (payload?.error) err.apiError = String(payload.error);
  err.status = status;

  // If the server reports session expired, clear token and redirect for tracked sessions
  try {
    const code = payload?.code || payload?.error;
    if (status === 401 && code === 'SESSION_EXPIRED') {
      if (shouldTrackInactivity()) {
        try { localStorage.removeItem('authToken'); localStorage.removeItem('lastActivityTimestamp'); } catch (e) {}
        try { window.location.href = '/login?reason=session_timeout'; } catch (e) {}
      }
    }
  } catch (e) {
    // swallow
  }

  throw err;
}

export class ApiService {
  private baseURL: string;
  private tenantId: number | null = null;
  private inFlightMutations = new Map<string, Promise<unknown>>();

  constructor(baseURL: string = resolveApiBaseUrl()) {
    this.baseURL = baseURL;
    const stored = localStorage.getItem('currentSchoolId');
    if (stored) {
      const id = parseInt(stored, 10);
      if (!isNaN(id)) this.tenantId = id;
    }
  }

  setTenantContext(schoolId: number) {
    this.tenantId = schoolId;
    localStorage.setItem('currentSchoolId', schoolId.toString());
  }

  clearTenantContext() {
    this.tenantId = null;
    localStorage.removeItem('currentSchoolId');
  }

  getBaseUrl() {
    return this.baseURL;
  }

  private buildURL(endpoint: string, addTenantId = true): string {
    let url = `${this.baseURL}${endpoint}`;
    if (addTenantId && this.tenantId !== null && !endpoint.includes('tenantId=')) {
      const separator = endpoint.includes('?') ? '&' : '?';
      url += `${separator}tenantId=${this.tenantId}`;
    }
    return url;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (this.tenantId !== null) {
      headers['X-Tenant-Id'] = this.tenantId.toString();
    } else {
      const slug = detectTenantSlugFromHost();
      if (slug) headers['X-Tenant-Slug'] = slug;
    }
    return headers;
  }

  private mutationKey(method: string, endpoint: string, data: unknown): string {
    const tenant = this.tenantId ?? detectTenantSlugFromHost() ?? 'public';
    const payload = data instanceof FormData ? formDataFingerprint(data) : stableStringify(data);
    return `${method}:${tenant}:${endpoint}:${hashRequestKey(payload)}`;
  }

  private withMutationGuard<T>(key: string, run: () => Promise<T>): Promise<T> {
    const existing = this.inFlightMutations.get(key);
    if (existing) return existing as Promise<T>;
    const promise = run().finally(() => {
      this.inFlightMutations.delete(key);
    });
    this.inFlightMutations.set(key, promise);
    return promise;
  }

  async get<T>(endpoint: string, options?: { skipTenant?: boolean }): Promise<T> {
    const response = await fetch(this.buildURL(endpoint, !options?.skipTenant), {
      headers: this.getAuthHeaders(),
    });
    const data = await readResponseJson<Record<string, unknown>>(response);
    if (!response.ok) {
      throwApiError(data, response.status);
    }
    return data as T;
  }

  /** Plain text / CSV (e.g. audit export). */
  async getText(endpoint: string): Promise<string> {
    const response = await fetch(this.buildURL(endpoint), {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(errText || `HTTP error! status: ${response.status}`);
    }
    return response.text();
  }

  /** Binary response (e.g. payment proof screenshots). */
  async getBlob(endpoint: string): Promise<Blob> {
    const headers = { ...this.getAuthHeaders() } as Record<string, string>;
    delete headers['Content-Type'];
    const response = await fetch(this.buildURL(endpoint), { headers });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(errText || `HTTP error! status: ${response.status}`);
    }
    return response.blob();
  }

  async postPublic<T>(endpoint: string, data: any): Promise<T> {
    const key = this.mutationKey('POST_PUBLIC', endpoint, data);
    return this.withMutationGuard(key, async () => {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': key },
        body: JSON.stringify(data),
      });
      const payload = await readResponseJson<any>(response);
      if (!response.ok) {
        throw new Error(payload.error || `Request failed (${response.status})`);
      }
      return payload as T;
    });
  }

  async post<T>(endpoint: string, data: unknown = {}, options?: { skipTenant?: boolean }): Promise<T> {
    const body = data ?? {};
    const key = this.mutationKey('POST', endpoint, body);
    return this.withMutationGuard(key, async () => {
      const headers = { ...this.getAuthHeaders(), 'X-Idempotency-Key': key };
      const response = await fetch(this.buildURL(endpoint, !options?.skipTenant), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const payload = await readResponseJson<Record<string, unknown>>(response);
      if (!response.ok) {
        throwApiError(payload, response.status);
      }
      return payload as T;
    });
  }

  async patch<T>(endpoint: string, data: any): Promise<T> {
    const key = this.mutationKey('PATCH', endpoint, data);
    return this.withMutationGuard(key, async () => {
      const response = await fetch(this.buildURL(endpoint), {
        method: 'PATCH',
        headers: { ...this.getAuthHeaders(), 'X-Idempotency-Key': key },
        body: JSON.stringify(data),
      });
      const payload = await readResponseJson<Record<string, unknown>>(response);
      if (!response.ok) {
        throwApiError(payload, response.status);
      }
      return payload as T;
    });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    const key = this.mutationKey('PUT', endpoint, data);
    return this.withMutationGuard(key, async () => {
      const response = await fetch(this.buildURL(endpoint), {
        method: 'PUT',
        headers: { ...this.getAuthHeaders(), 'X-Idempotency-Key': key },
        body: JSON.stringify(data),
      });
      const payload = await readResponseJson<Record<string, unknown>>(response);
      if (!response.ok) {
        throwApiError(payload, response.status);
      }
      return payload as T;
    });
  }

  async delete<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(this.buildURL(endpoint), {
      method: 'DELETE',
      headers:
        data != null
          ? { ...this.getAuthHeaders(), 'Content-Type': 'application/json' }
          : this.getAuthHeaders(),
      body: data != null ? JSON.stringify(data) : undefined,
    });
    const payload = await readResponseJson<Record<string, unknown>>(response);
    if (!response.ok) {
      throwApiError(payload, response.status);
    }
    return payload as T;
  }

  async uploadStudentPhoto(studentId: string, file: File): Promise<unknown> {
    const formData = new FormData();
    formData.append('photo', file);
    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const endpoint = `/students/${studentId}/photo`;
    const key = this.mutationKey('POST_FORM', endpoint, formData);
    return this.withMutationGuard(key, async () => {
      const response = await fetch(this.buildURL(endpoint), {
        method: 'POST',
        headers: { ...headers, 'X-Idempotency-Key': key },
        body: formData,
      });
      if (!response.ok) {
        const error = await readResponseJson<{ error?: string }>(response).catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }
      return readResponseJson(response);
    });
  }

  async uploadTeacherPhoto(teacherId: string, file: File): Promise<unknown> {
    return this.uploadFile(`/teachers/${teacherId}/photo`, file, 'photo');
  }

  async uploadOtherStaffPhoto(staffId: string, file: File): Promise<unknown> {
    return this.uploadFile(`/other-staff/${staffId}/photo`, file, 'photo');
  }

  async uploadFile<T>(endpoint: string, file: File, fieldName: string = 'file'): Promise<T> {
    const formData = new FormData();
    formData.append(fieldName, file);
    
    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const key = this.mutationKey('POST_FORM', endpoint, formData);
    return this.withMutationGuard(key, async () => {
      const response = await fetch(this.buildURL(endpoint), {
        method: 'POST',
        headers: { ...headers, 'X-Idempotency-Key': key },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await readResponseJson<{ error?: string }>(response).catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }
      return readResponseJson<T>(response);
    });
  }

  async postForm<T>(endpoint: string, formData: FormData, options?: { skipTenant?: boolean }): Promise<T> {
    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (this.tenantId !== null) headers['X-Tenant-Id'] = this.tenantId.toString();

    const key = this.mutationKey('POST_FORM', endpoint, formData);
    return this.withMutationGuard(key, async () => {
      const response = await fetch(this.buildURL(endpoint, !options?.skipTenant), {
        method: 'POST',
        headers: { ...headers, 'X-Idempotency-Key': key },
        body: formData,
      });
      const payload = await readResponseJson<{ error?: string; message?: string }>(response);
      if (!response.ok) {
        throw new Error(payload.message || payload.error || `HTTP error! status: ${response.status}`);
      }
      return payload as T;
    });
  }
}

export const apiService = new ApiService();
