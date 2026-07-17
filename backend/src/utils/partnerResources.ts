import type { Request } from 'express';
import { resolvePublicAppUrl } from './publicAppUrl.js';

type UrlRequest = Pick<Request, 'protocol' | 'get' | 'hostname' | 'headers'>;

/** Shareable demo booking link partners can give schools (includes partner ref when assigned). */
export function resolvePartnerDemoBookingUrl(
  req?: UrlRequest,
  partnerPublicId?: string | null
): string {
  const configured = String(process.env.PARTNER_DEMO_BOOKING_URL || '').trim();
  const base = configured || `${resolvePublicAppUrl(req)}/book-demo`;
  try {
    const url = new URL(base.startsWith('http') ? base : `https://${base}`);
    if (partnerPublicId) url.searchParams.set('partner', partnerPublicId);
    return url.toString();
  } catch {
    const fallback = configured || 'https://scholarnerve.com/book-demo';
    return partnerPublicId ? `${fallback}?partner=${encodeURIComponent(partnerPublicId)}` : fallback;
  }
}
