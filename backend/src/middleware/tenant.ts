import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { query } from '../db/connection.js';

export const setTenantContext = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Super-admin can access any tenant via query param
    if (req.user.role === 'super-admin' && req.query.tenantId) {
      const tenantId = parseInt(req.query.tenantId as string);
      const tenantCheck = await query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
      
      if (tenantCheck.rows.length > 0) {
        req.user.tenantId = tenantId;
      }
    }
    
    // Ensure tenant context is set for non-super-admin users
    if (req.user.role !== 'super-admin' && !req.user.tenantId) {
      return res.status(403).json({ error: 'No tenant assigned' });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to set tenant context' });
  }
};
