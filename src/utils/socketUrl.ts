import { resolveApiOrigin } from './mediaUrl';

/**
 * Resolve the Socket.IO server base URL.
 *
 * Production (scholarnerve.com + school subdomains): same origin — nginx/Caddy proxy
 * `/socket.io` to the Node backend. Never use a cross-origin API host for sockets.
 *
 * Local dev: same-origin when Vite proxies /socket.io.
 */
export function resolveSocketBaseUrl(): string {
  if (typeof window === 'undefined') {
    return resolveApiOrigin();
  }

  const { hostname, origin } = window.location;
  const isLocalDev =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.lvh.me');
  const isScholarNerveHost =
    hostname === 'scholarnerve.com' ||
    hostname.endsWith('.scholarnerve.com');

  if (isScholarNerveHost) {
    return origin;
  }

  if (hostname === 'partners.localhost' || hostname.endsWith('.localhost')) {
    return origin;
  }

  if (isLocalDev && import.meta.env.DEV) {
    // Vite dev server proxies /socket.io → backend; same-origin works in dev too.
    return origin;
  }

  return resolveApiOrigin();
}

export const SOCKET_IO_PATH = '/socket.io';

export const SOCKET_IO_OPTIONS = {
  path: SOCKET_IO_PATH,
  transports: ['websocket', 'polling'] as ('polling' | 'websocket')[],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  withCredentials: true,
};
