import express from 'express';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  getFeeStructureItems,
  getFeeStructureItemsSummary,
  saveFeeStructureItems,
} from '../services/feeStructureItemsService.js';
import { query } from '../db/connection.js';
import { sqlBeneficiaryAdjustedAmount } from '../utils/beneficiaryFee.js';
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

const LEDGER_DEBIT_FROM_STANDARD_FEE = sqlBeneficiaryAdjustedAmount('$4').trim();

async function syncLedgerDebitsForStructure(
  tenantId: number,
  feeStructureId: number,
  total: number
) {
  const row = await query(
    `SELECT class_id, term_id FROM ledger_fee_structures WHERE id = $1 AND tenant_id = $2`,
    [feeStructureId, tenantId]
  );
  if (row.rows.length === 0) return;
  const { class_id: classId, term_id: termId } = row.rows[0];
  await query(
    `UPDATE student_ledger AS sl
     SET debit = ${LEDGER_DEBIT_FROM_STANDARD_FEE}
     FROM students AS s
     WHERE sl.student_id = s.id
       AND sl.tenant_id = $1
       AND sl.term_id = $2
       AND sl.entry_type = 'term_fee'
       AND s.tenant_id = $1
       AND s.class_assigned_id = $3`,
    [tenantId, termId, classId, total]
  );
}

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

router.get('/:id/items/summary', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const feeStructureId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(feeStructureId)) {
      return res.status(400).json({ error: 'Invalid fee structure id' });
    }
    const summary = await getFeeStructureItemsSummary(tenantId, feeStructureId);
    if (!summary) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }
    res.json(summary);
  } catch (error) {
    console.error('Get fee structure items summary error:', error);
    res.status(500).json({ error: 'Failed to fetch fee structure summary' });
  }
});

router.get('/:id/items', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const feeStructureId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(feeStructureId)) {
      return res.status(400).json({ error: 'Invalid fee structure id' });
    }
    const items = await getFeeStructureItems(tenantId, feeStructureId);
    if (!items) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }
    res.json(items);
  } catch (error) {
    console.error('Get fee structure items error:', error);
    res.status(500).json({ error: 'Failed to fetch fee structure items' });
  }
});

router.post(
  '/:id/items',
  requireRole('super-admin', 'administrator', 'finance'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const feeStructureId = parseInt(String(req.params.id), 10);
      if (Number.isNaN(feeStructureId)) {
        return res.status(400).json({ error: 'Invalid fee structure id' });
      }
      const items = Array.isArray(req.body?.items) ? req.body.items : null;
      if (!items) {
        return res.status(400).json({ error: 'items array is required' });
      }
      const saved = await saveFeeStructureItems(tenantId, feeStructureId, items);
      if (!saved) {
        return res.status(404).json({ error: 'Fee structure not found' });
      }
      await syncLedgerDebitsForStructure(tenantId, feeStructureId, saved.total);
      emitTenantDataChanged(tenantId, 'fee', 'updated');
      res.json(saved);
    } catch (error: any) {
      const message = error?.message || 'Failed to save fee structure items';
      if (message.includes('Tuition') || message.includes('enabled but')) {
        return res.status(400).json({ error: message });
      }
      console.error('Save fee structure items error:', error);
      res.status(500).json({ error: 'Failed to save fee structure items' });
    }
  }
);

export default router;
