
// Base API service for future backend integration
export class ApiService {
  private baseURL: string;
  private authToken: string | null = null;

  constructor(baseURL: string = (import.meta.env.VITE_API_BASE as string) ?? '/api') {
    this.baseURL = baseURL;
    // Helpful dev-time log to confirm frontend is using the expected API base
    try {
      // `import.meta.env.DEV` is true in Vite dev mode
      if ((import.meta as any).env?.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[ApiService] baseURL ->', this.baseURL);
      }
    } catch (e) {
      // ignore in non-Vite environments
    }
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private headers(extra: Record<string, string> = {}) {
    const h: Record<string, string> = { ...extra };
    if (this.authToken) h['Authorization'] = `Bearer ${this.authToken}`;
    if (!h['Content-Type']) h['Content-Type'] = 'application/json';
    return h;
  }

  private async request<T>(endpoint: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseURL}${endpoint}`, opts);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let body: any = text;
      try { body = JSON.parse(text); } catch (e) { /* ignore */ }
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      (err as any).status = res.status;
      (err as any).body = body;
      throw err;
    }
    return res.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers: this.headers() });
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', headers: this.headers(), body: JSON.stringify(data) });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', headers: this.headers(), body: JSON.stringify(data) });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers: this.headers() });
  }
}

export const apiService = new ApiService();
