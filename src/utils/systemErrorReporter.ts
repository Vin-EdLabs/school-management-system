const API_BASE = (() => {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3001/api';
    return `${window.location.protocol}//${window.location.host}/api`;
  }
  return '/api';
})();

let reportingEnabled = true;
const reported = new Set<string>();

function detectTenantIdFromPath(): number | null {
  const path = window.location.pathname;
  const portalMatch = path.match(/^\/portal\/(\d+)/i);
  if (portalMatch) return Number(portalMatch[1]);
  const schoolMatch = path.match(/^\/school\/(\d+)/i);
  if (schoolMatch) return Number(schoolMatch[1]);
  return null;
}

function fingerprint(message: string, source: string, endpoint?: string): string {
  return `${source}:${endpoint || ''}:${message}`.slice(0, 500);
}

export async function reportClientError(payload: {
  message: string;
  stack?: string | null;
  source?: 'frontend' | 'pwa' | 'service_worker';
  endpoint?: string | null;
  action?: string | null;
  severity?: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}) {
  if (!reportingEnabled || typeof window === 'undefined') return;

  const key = fingerprint(payload.message, payload.source || 'frontend', payload.endpoint || undefined);
  if (reported.has(key)) return;
  reported.add(key);

  try {
    await fetch(`${API_BASE}/system/errors/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        message: payload.message,
        stack: payload.stack || null,
        source: payload.source || 'frontend',
        tenantId: detectTenantIdFromPath(),
        endpoint: payload.endpoint || window.location.pathname,
        action: payload.action || null,
        severity: payload.severity || 'warning',
        metadata: {
          userAgent: navigator.userAgent,
          href: window.location.href,
          ...(payload.metadata || {}),
        },
      }),
    });
  } catch {
    // Never break the app while reporting errors.
  }
}

export function initSystemErrorReporter() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    reportClientError({
      message: event.message || 'Unhandled window error',
      stack: event.error?.stack || null,
      source: 'frontend',
      endpoint: event.filename || window.location.pathname,
      severity: 'critical',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportClientError({
      message: reason?.message || String(reason || 'Unhandled promise rejection'),
      stack: reason?.stack || null,
      source: 'frontend',
      endpoint: window.location.pathname,
      severity: 'critical',
    });
  });

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);
    const pwaMessage = args.find((arg) => typeof arg === 'string' && arg.includes('[PWA'));
    if (pwaMessage) {
      reportClientError({
        message: String(pwaMessage),
        source: 'pwa',
        endpoint: window.location.pathname,
        severity: 'warning',
        metadata: { args: args.map((a) => String(a)).slice(0, 5) },
      });
    }
  };
}

export function setErrorReportingEnabled(enabled: boolean) {
  reportingEnabled = enabled;
}
