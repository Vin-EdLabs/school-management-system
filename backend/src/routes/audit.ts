import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';

const router = express.Router();

// Super-admin: Get ALL audit logs (no tenant filter) - monitors everything across all schools
router.get('/all', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, action, entityType, tenantId, username, limit = 500 } = req.query;

    let queryText = `
      SELECT al.*, u.username, t.name as tenant_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN tenants t ON al.tenant_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      queryText += ` AND al.created_at::date BETWEEN $${params.length + 1}::date AND $${params.length + 2}::date`;
      params.push(startDate, endDate);
    }

    if (action) {
      queryText += ` AND al.action = $${params.length + 1}`;
      params.push(action);
    }

    if (entityType) {
      queryText += ` AND al.entity_type = $${params.length + 1}`;
      params.push(entityType);
    }

    if (tenantId) {
      queryText += ` AND al.tenant_id = $${params.length + 1}`;
      params.push(tenantId);
    }

    if (username) {
      queryText += ` AND u.username ILIKE $${params.length + 1}`;
      params.push(`%${username}%`);
    }

    queryText += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(parseInt(limit as string) || 500, 1000));

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get all audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

// Get audit logs (tenant-scoped) - each school sees only its logs
router.get('/', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { startDate, endDate, action, entityType, userId, limit = 200 } = req.query;
    
    let queryText = `
      SELECT al.*, u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    
    if (startDate && endDate) {
      queryText += ` AND al.created_at BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(startDate, endDate);
    }
    
    if (action) {
      queryText += ` AND al.action = $${params.length + 1}`;
      params.push(action);
    }
    
    if (entityType) {
      queryText += ` AND al.entity_type = $${params.length + 1}`;
      params.push(entityType);
    }
    
    if (userId) {
      queryText += ` AND al.user_id = $${params.length + 1}`;
      params.push(userId);
    }
    
    queryText += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit as string));
    
    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get single audit log
router.get('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    const result = await query(
      `SELECT al.*, u.username
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.id = $1 AND al.tenant_id = $2`,
      [id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

export default router;
