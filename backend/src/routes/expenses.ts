import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';

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

// Get all expenses
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { startDate, endDate, category, term, academicYear } = req.query;
    
    let queryText = 'SELECT * FROM expenses WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    
    if (startDate && endDate) {
      queryText += ` AND payment_date BETWEEN $${params.length + 1} AND $${params.length + 2}`;
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
    
    queryText += ' ORDER BY payment_date DESC, created_at DESC';
    
    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Get single expense
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    const result = await query(
      'SELECT * FROM expenses WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense record not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// Create expense
router.post('/', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { title, category, amount, payee_name, payment_date, payment_method, purpose, notes, description, vendor, term, academic_year } = req.body;
    
    if (!title || !amount || !payment_date) {
      return res.status(400).json({ error: 'Title, amount, and payment date are required' });
    }
    
    const result = await query(
      `INSERT INTO expenses (tenant_id, title, category, amount, payee_name, payment_date, payment_method, purpose, notes, description, vendor, term, academic_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        tenantId,
        title,
        category || null,
        amount,
        payee_name || null,
        payment_date,
        payment_method || null,
        purpose || null,
        notes || null,
        description || null,
        vendor || null,
        term || null,
        academic_year || null,
      ]
    );
    
    const row = result.rows[0];
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'EXPENSE_CREATE',
      entityType: 'EXPENSE',
      entityId: row.id,
      module: 'finance',
      status: 'success',
      summary: `Expense "${title}" created — GHS ${amount}`,
      details: {
        expense_id: row.id,
        title,
        category: category || null,
        amount: Number(amount),
        payee_name: payee_name || null,
        payment_date,
        payment_method: payment_method || null,
        vendor: vendor || null,
        term: term || null,
        academic_year: academic_year || null,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'expense', 'created');
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update expense
router.put('/:id', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const updates = req.body;
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    const allowedFields = ['title', 'category', 'amount', 'payee_name', 'payment_date', 'payment_method', 'purpose', 'notes', 'description', 'vendor', 'term', 'academic_year'];
    
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

    const oldRes = await query('SELECT * FROM expenses WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
    if (oldRes.rows.length === 0) {
      return res.status(404).json({ error: 'Expense record not found' });
    }
    const previous = oldRes.rows[0] as Record<string, unknown>;
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(tenantId, id);
    
    const result = await query(
      `UPDATE expenses SET ${updateFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense record not found' });
    }
    const next = result.rows[0] as Record<string, unknown>;
    const prevAmount = previous.amount != null ? Number(previous.amount) : null;
    const nextAmount = next.amount != null ? Number(next.amount) : null;
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'EXPENSE_UPDATE',
      entityType: 'EXPENSE',
      entityId: parseInt(id, 10),
      module: 'finance',
      status: 'success',
      summary:
        prevAmount != null && nextAmount != null && prevAmount !== nextAmount
          ? `Expense edited from GHS ${prevAmount} to GHS ${nextAmount}`
          : `Expense "${String(next.title ?? previous.title)}" updated`,
      details: {
        expense_id: parseInt(id, 10),
        previous,
        new: next,
        amount_affected: nextAmount,
        changed_fields: Object.keys(updates).filter((k) => allowedFields.includes(k)),
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'expense', 'updated');
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete expense
router.delete('/:id', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM expenses WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense record not found' });
    }
    const deleted = result.rows[0] as Record<string, unknown>;
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'EXPENSE_DELETE',
      entityType: 'EXPENSE',
      entityId: parseInt(id, 10),
      module: 'finance',
      status: 'success',
      summary: `Expense deleted — "${String(deleted.title ?? id)}" (GHS ${deleted.amount ?? '—'})`,
      details: { expense_id: parseInt(id, 10), deleted_record: deleted },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'expense', 'deleted');
    
    res.json({ message: 'Expense record deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
