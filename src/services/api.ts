
// API service for backend integration
import { detectTenantSlugFromHost } from '../utils/tenantHost';

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
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function hashRequestKey(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
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

function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'scholarnerve.com' || host.endsWith('.scholarnerve.com')) {
      return `${window.location.origin}/api`;
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    }
    if (host.endsWith('.lvh.me')) {
      return import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`;
    }
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
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

  private buildURL(endpoint: string, addTenantId = true): string {
    let url = `${this.baseURL}${endpoint}`;
    if (addTenantId && this.tenantId !== null) {
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

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(this.buildURL(endpoint), {
      headers: this.getAuthHeaders(),
    });
    const data = await readResponseJson<any>(response);
    if (!response.ok) {
      throw new Error(data?.error || `Request failed (${response.status})`);
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

  async post<T>(endpoint: string, data: any): Promise<T> {
    const key = this.mutationKey('POST', endpoint, data);
    return this.withMutationGuard(key, async () => {
      const headers = { ...this.getAuthHeaders(), 'X-Idempotency-Key': key };
      const response = await fetch(this.buildURL(endpoint), {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      const payload = await readResponseJson<any>(response);
      if (!response.ok) {
        let msg = payload.error || `Request failed (${response.status})`;
        if (payload.hint) msg += ` ${payload.hint}`;
        if (payload.detail) msg += ` (${payload.detail})`;
        throw new Error(msg);
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
      const payload = await readResponseJson<any>(response);
      if (!response.ok) {
        throw new Error(payload.error || `Request failed (${response.status})`);
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
      const payload = await readResponseJson<any>(response);
      if (!response.ok) {
        throw new Error(payload.error || `Request failed (${response.status})`);
      }
      return payload as T;
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(this.buildURL(endpoint), {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    const payload = await readResponseJson<any>(response);
    if (!response.ok) {
      throw new Error(payload.error || `Request failed (${response.status})`);
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

  async postForm<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (this.tenantId !== null) headers['X-Tenant-Id'] = this.tenantId.toString();

    const key = this.mutationKey('POST_FORM', endpoint, formData);
    return this.withMutationGuard(key, async () => {
      const response = await fetch(this.buildURL(endpoint), {
        method: 'POST',
        headers: { ...headers, 'X-Idempotency-Key': key },
        body: formData,
      });
      if (!response.ok) {
        const error = await readResponseJson<{ error?: string }>(response).catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }
      return readResponseJson<T>(response);
    });
  }
}

export const apiService = new ApiService();
