
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

export class ApiService {
  private baseURL: string;
  private tenantId: number | null = null;

  constructor(baseURL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api') {
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
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const payload = await readResponseJson<any>(response);
    if (!response.ok) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return payload as T;
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(this.buildURL(endpoint), {
      method: 'POST',
      headers: this.getAuthHeaders(),
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
  }

  async patch<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(this.buildURL(endpoint), {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const payload = await readResponseJson<any>(response);
    if (!response.ok) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return payload as T;
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(this.buildURL(endpoint), {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const payload = await readResponseJson<any>(response);
    if (!response.ok) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return payload as T;
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
    const response = await fetch(this.buildURL(`/students/${studentId}/photo`), {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const error = await readResponseJson<{ error?: string }>(response).catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return readResponseJson(response);
  }

  async uploadFile<T>(endpoint: string, file: File, fieldName: string = 'file'): Promise<T> {
    const formData = new FormData();
    formData.append(fieldName, file);
    
    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(this.buildURL(endpoint), {
      method: 'POST',
      headers,
      body: formData,
    });
    
    if (!response.ok) {
      const error = await readResponseJson<{ error?: string }>(response).catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return readResponseJson<T>(response);
  }

  async postForm<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (this.tenantId !== null) headers['X-Tenant-Id'] = this.tenantId.toString();

    const response = await fetch(this.buildURL(endpoint), {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const error = await readResponseJson<{ error?: string }>(response).catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return readResponseJson<T>(response);
  }
}

export const apiService = new ApiService();
