import type { Request } from 'express';

function stripV4Mapped(ip: string): string {
  return ip.replace(/^::ffff:/i, '').trim();
}

/**
 * Client IP for audit / security: prefers proxy headers (public IP when behind nginx/Render/Cloudflare).
 */
export function getClientIp(req: Pick<Request, 'headers' | 'socket' | 'ip'>): string | null {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    const first = xf.split(',')[0]?.trim();
    if (first) return stripV4Mapped(first);
  }
  if (Array.isArray(xf) && xf[0]) {
    const first = String(xf[0]).split(',')[0]?.trim();
    if (first) return stripV4Mapped(first);
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.trim()) return stripV4Mapped(real.trim());
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return stripV4Mapped(cf.trim());
  const raw = req.socket?.remoteAddress || req.ip;
  return raw ? stripV4Mapped(String(raw)) : null;
}
