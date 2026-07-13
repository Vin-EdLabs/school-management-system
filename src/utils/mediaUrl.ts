/** Origin for uploaded files (/uploads/...), aligned with api.ts base URL resolution. */
export function resolveApiOrigin(): string {
  const envBase =
    typeof import.meta !== 'undefined' ? String(import.meta.env?.VITE_API_BASE_URL || '').trim() : '';
  if (envBase) {
    return envBase.replace(/\/api\/?$/, '');
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'scholarnerve.com' || host.endsWith('.scholarnerve.com')) {
      return window.location.origin;
    }
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.lvh.me')) {
      return window.location.origin;
    }
    return window.location.origin;
  }

  return 'http://localhost:3001';
}

/** Turn a stored upload path into a browser-loadable URL. */
export function resolveUploadUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;

  const path = url.startsWith('/') ? url : `/${url}`;
  const origin = resolveApiOrigin();

  if (typeof window !== 'undefined' && origin === window.location.origin) {
    return path;
  }

  return `${origin}${path}`;
}
