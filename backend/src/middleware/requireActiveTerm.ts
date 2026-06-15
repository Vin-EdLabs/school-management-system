import type { Response, NextFunction } from 'express';
import { query } from '../db/connection.js';
import type { AuthRequest } from './auth.js';

const NO_ACTIVE_TERM_RESPONSE = {
  success: false,
  code: 'NO_ACTIVE_TERM',
  message: 'No active term. Please set an active academic term in Settings before using this feature.',
};

/**
 * Blocks mutations when no active academic term is configured.
 */
export async function requireActiveTerm(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      next();
      return;
    }

    const activeRes = await query(
      `SELECT id FROM academic_terms
       WHERE tenant_id = $1
         AND is_active = true
         AND COALESCE(is_archived, false) = false
       LIMIT 1`,
      [tenantId]
    );
    if (activeRes.rows.length > 0) {
      next();
      return;
    }

    const settingsRes = await query(
      `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    const currentTerm = String(settingsRes.rows[0]?.current_term || '').trim();
    const currentYear = String(settingsRes.rows[0]?.current_year || '').trim();
    if (currentTerm && currentYear && currentTerm !== 'Not Set') {
      next();
      return;
    }

    res.status(403).json(NO_ACTIVE_TERM_RESPONSE);
  } catch (err) {
    console.error('[requireActiveTerm]', err);
    res.status(500).json({ success: false, error: 'Failed to verify active term' });
  }
}
