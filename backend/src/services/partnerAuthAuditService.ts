import type { Request } from 'express';
import { query } from '../db/connection.js';

export type PartnerAuthEventType = 'login' | 'logout';

function resolveClientIp(req: Request): string | null {
  const forwarded = req.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = req.get('x-real-ip')?.trim();
  const ip = forwarded || realIp || req.ip || req.socket?.remoteAddress || null;
  if (!ip) return null;
  return String(ip).slice(0, 64);
}

export async function logPartnerAuthEvent(
  partnerDbId: number,
  eventType: PartnerAuthEventType,
  req: Request,
): Promise<void> {
  const ip = resolveClientIp(req);
  const userAgent = req.get('user-agent') ? String(req.get('user-agent')).slice(0, 512) : null;
  await query(
    `INSERT INTO partner_login_events (partner_id, event_type, ip_address, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [partnerDbId, eventType, ip, userAgent]
  ).catch((err) => console.warn('[partner-auth-audit] log failed:', err));
}
