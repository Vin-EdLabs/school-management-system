import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { query } from '../db/connection.js';

/**
 * Partner Network auth — completely separate from school staff and parent auth.
 * Tokens are signed with a partner-prefixed secret so a staff/parent JWT can
 * never be replayed against partner routes (and vice versa).
 */
const PARTNER_JWT_SECRET = `sn-partners::${process.env.JWT_SECRET || 'secret'}`;
const PARTNER_TOKEN_TTL = '30d';

export type PartnerAuthPayload = {
  partnerId: number; // partners.id (numeric PK)
  email: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
};

export interface PartnerAuthRequest extends Request {
  partner?: PartnerAuthPayload;
}

export function signPartnerToken(partner: { id: number; email: string }): string {
  return jwt.sign(
    { role: 'sn-partner', partnerId: partner.id, email: partner.email },
    PARTNER_JWT_SECRET,
    { expiresIn: PARTNER_TOKEN_TTL }
  );
}

export async function authenticatePartner(
  req: PartnerAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, PARTNER_JWT_SECRET) as {
      role?: string;
      partnerId?: number;
    };
    if (decoded.role !== 'sn-partner' || !decoded.partnerId) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const result = await query(
      'SELECT id, email, status FROM partners WHERE id = $1',
      [decoded.partnerId]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Partner account not found' });
      return;
    }

    const row = result.rows[0];
    if (row.status === 'rejected') {
      res.status(403).json({ error: 'This partner application was not approved' });
      return;
    }

    req.partner = {
      partnerId: Number(row.id),
      email: String(row.email),
      status: row.status,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/** Block write actions for suspended partner accounts (GET /me still allowed). */
export function rejectIfSuspended(
  req: PartnerAuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.partner?.status === 'suspended') {
    res.status(403).json({
      error: 'Your partner account has been suspended. Contact ScholarNerve support.',
      code: 'PARTNER_SUSPENDED',
    });
    return;
  }
  next();
}
