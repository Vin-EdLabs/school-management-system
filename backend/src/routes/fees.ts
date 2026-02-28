import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

// Get all fee structures
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId, term } = req.query;
    
    let queryText = `
      SELECT fs.*, c.class_name, c.level, c.stream
      FROM fee_structures fs
      LEFT JOIN classes c ON fs.class_id = c.id
      WHERE fs.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    
    if (classId) {
      queryText += ' AND fs.class_id = $2';
      params.push(classId);
      if (term) {
        queryText += ' AND fs.term = $3';
        params.push(term);
      }
    } else if (term) {
      queryText += ' AND fs.term = $2';
      params.push(term);
    }
    
    queryText += ' ORDER BY fs.created_at DESC';
    
    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get fee structures error:', error);
    res.status(500).json({ error: 'Failed to fetch fee structures' });
  }
});

// Get single fee structure
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    const result = await query(
      `SELECT fs.*, c.class_name, c.level, c.stream
       FROM fee_structures fs
       LEFT JOIN classes c ON fs.class_id = c.id
       WHERE fs.id = $1 AND fs.tenant_id = $2`,
      [id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get fee structure error:', error);
    res.status(500).json({ error: 'Failed to fetch fee structure' });
  }
});

// Create fee structure
router.post('/', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { class_id, term, amount, due_date, description } = req.body;
    
    if (!class_id || !term || !amount) {
      return res.status(400).json({ error: 'Class ID, term, and amount are required' });
    }
    
    const result = await query(
      `INSERT INTO fee_structures (tenant_id, class_id, term, amount, due_date, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        tenantId,
        class_id,
        term,
        amount,
        due_date || null,
        description || null,
      ]
    );
    
    // Log creation
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'CREATE', 'FEE_STRUCTURE', result.rows[0].id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create fee structure error:', error);
    res.status(500).json({ error: 'Failed to create fee structure' });
  }
});

// Update fee structure
router.put('/:id', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const updates = req.body;
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    const allowedFields = ['class_id', 'term', 'amount', 'due_date', 'description'];
    
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
      `UPDATE fee_structures SET ${updateFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }
    
    // Log update
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'UPDATE', 'FEE_STRUCTURE', parseInt(id)]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update fee structure error:', error);
    res.status(500).json({ error: 'Failed to update fee structure' });
  }
});

// Delete fee structure (with validation: block if payments exist for this class/term)
router.delete('/:id', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;

    // Get fee structure to find class_id and term
    const feeResult = await query(
      'SELECT class_id, term FROM fee_structures WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (feeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }
    const { class_id, term } = feeResult.rows[0];

    // Check if any payments exist for students in this class for this term
    const paymentsCheck = await query(
      `SELECT COUNT(*) as count FROM payments p
       JOIN students s ON p.student_id = s.id
       WHERE p.tenant_id = $1 AND s.class_assigned_id = $2
       AND (p.term = $3 OR p.term LIKE $4)`,
      [tenantId, class_id, term, `${term}%`]
    );
    const paymentCount = parseInt(paymentsCheck.rows[0]?.count || '0');
    if (paymentCount > 0) {
      return res.status(400).json({
        error: `${paymentCount} payment(s) already recorded for this class/term. Delete or adjust payments first.`,
      });
    }
    
    const result = await query(
      'DELETE FROM fee_structures WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    
    // Log deletion
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'DELETE', 'FEE_STRUCTURE', parseInt(id)]
    );
    
    res.json({ message: 'Fee structure deleted successfully' });
  } catch (error) {
    console.error('Delete fee structure error:', error);
    res.status(500).json({ error: 'Failed to delete fee structure' });
  }
});

export default router;
