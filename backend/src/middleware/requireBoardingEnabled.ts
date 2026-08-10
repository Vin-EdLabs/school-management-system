import { Response, NextFunction } from 'express';
import { query } from '../db/connection.js';
import type { AuthRequest } from './auth.js';

export async function requireBoardingEnabled(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'School context required' });
    }
    const result = await query('SELECT boarding_enabled FROM tenants WHERE id = $1', [tenantId]);
    if (result.rows.length === 0 || !result.rows[0].boarding_enabled) {
      return res.status(403).json({
        error: 'Boarding module is not enabled for this school',
        code: 'BOARDING_DISABLED',
      });
    }
    return next();
  } catch (error) {
    console.error('requireBoardingEnabled error:', error);
    return res.status(500).json({ error: 'Failed to verify boarding module' });
  }
}
