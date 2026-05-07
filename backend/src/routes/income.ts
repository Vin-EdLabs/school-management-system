import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';

const router = express.Router();

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

// Get all income
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { startDate, endDate, category, term, academicYear } = req.query;
    
    let queryText = 'SELECT * FROM income WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    
    if (startDate && endDate) {
      queryText += ` AND income_date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(startDate, endDate);
    }
    
    if (category) {
      queryText += ` AND category = $${params.length + 1}`;
      params.push(category);
    }
    
    if (term) {
      queryText += ` AND (term = $${params.length + 1} OR term LIKE $${params.length + 2})`;
      params.push(term, `${term}%`);
    }
    
    if (academicYear) {
      queryText += ` AND academic_year = $${params.length + 1}`;
      params.push(academicYear);
    }
    
    queryText += ' ORDER BY income_date DESC, created_at DESC';
    
    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get income error:', error);
    res.status(500).json({ error: 'Failed to fetch income' });
  }
});

// Get single income
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    const result = await query(
      'SELECT * FROM income WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income record not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get income error:', error);
    res.status(500).json({ error: 'Failed to fetch income' });
  }
});

// Create income
router.post('/', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { source, amount, income_date, payment_method, received_by, notes, description, category, term, academic_year } = req.body;
    
    if (!source || !amount || !income_date) {
      return res.status(400).json({ error: 'Source, amount, and income date are required' });
    }
    
    const result = await query(
      `INSERT INTO income (tenant_id, source, amount, income_date, payment_method, received_by, notes, description, category, term, academic_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        tenantId,
        source,
        amount,
        income_date,
        payment_method || null,
        received_by || null,
        notes || null,
        description || null,
        category || null,
        term || null,
        academic_year || null,
      ]
    );
    
    // Log creation
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'CREATE', 'INCOME', result.rows[0].id]
    );
    emitTenantDataChanged(tenantId, 'income', 'created');
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create income error:', error);
    res.status(500).json({ error: 'Failed to create income' });
  }
});

// Update income
router.put('/:id', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const updates = req.body;
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    const allowedFields = ['source', 'amount', 'income_date', 'payment_method', 'received_by', 'notes', 'description', 'category', 'term', 'academic_year'];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        values.push(updates[field]);
        paramCount++;
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(tenantId, id);
    
    const result = await query(
      `UPDATE income SET ${updateFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income record not found' });
    }
    
    // Log update
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'UPDATE', 'INCOME', parseInt(id)]
    );
    emitTenantDataChanged(tenantId, 'income', 'updated');
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update income error:', error);
    res.status(500).json({ error: 'Failed to update income' });
  }
});

// Delete income
router.delete('/:id', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM income WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income record not found' });
    }
    
    // Log deletion
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'DELETE', 'INCOME', parseInt(id)]
    );
    emitTenantDataChanged(tenantId, 'income', 'deleted');
    
    res.json({ message: 'Income record deleted successfully' });
  } catch (error) {
    console.error('Delete income error:', error);
    res.status(500).json({ error: 'Failed to delete income' });
  }
});

export default router;
