import express from 'express';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  getFeeStructureItems,
  getFeeStructureItemsSummary,
  saveFeeStructureItems,
} from '../services/feeStructureItemsService.js';
import { query } from '../db/connection.js';
import {
  SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE,
  SQL_FEE_STRUCTURE_CLASS_MATCH,
} from '../utils/feeStructureSql.js';
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

/** Post or update term_fee ledger rows for all students matching this fee structure's class. */
async function syncLedgerDebitsForStructure(tenantId: number, feeStructureId: number) {
  const row = await query(
    `SELECT fs.class_id, fs.term_id, fs.academic_year_id, t.name AS term_name
     FROM ledger_fee_structures fs
     JOIN terms t ON t.id = fs.term_id AND t.tenant_id = fs.tenant_id
     WHERE fs.id = $1 AND fs.tenant_id = $2`,
    [feeStructureId, tenantId]
  );
  if (row.rows.length === 0) return;
  const { term_id: termId, academic_year_id: academicYearId, term_name: termName } =
    row.rows[0];

  await query(
    `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit)
     SELECT DISTINCT ON (s.id)
       s.tenant_id,
       s.id,
       $3,
       $2,
       'Term Fee - ' || $4,
       'term_fee',
       (${SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE.trim()}),
       0
     FROM students s
     INNER JOIN terms t ON t.id = $2 AND t.tenant_id = $1
     INNER JOIN classes c_student ON c_student.id = s.class_assigned_id AND c_student.tenant_id = s.tenant_id
     INNER JOIN ledger_fee_structures fs ON fs.id = $5 AND fs.tenant_id = s.tenant_id
     INNER JOIN classes c_fs ON c_fs.id = fs.class_id AND c_fs.tenant_id = fs.tenant_id
     WHERE s.tenant_id = $1
       AND COALESCE(s.enrollment_status, 'active') = 'active'
       AND s.class_assigned_id IS NOT NULL
       AND ${SQL_FEE_STRUCTURE_CLASS_MATCH}
       AND NOT EXISTS (
         SELECT 1 FROM student_ledger sl
         WHERE sl.tenant_id = $1 AND sl.student_id = s.id AND sl.term_id = $2 AND sl.entry_type = 'term_fee'
       )
     ORDER BY s.id`,
    [tenantId, termId, academicYearId, termName, feeStructureId]
  );

  await query(
    `UPDATE student_ledger sl
     SET debit = sub.net_fee
     FROM (
       SELECT DISTINCT ON (s.id)
         s.id AS student_id,
         (${SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE.trim()}) AS net_fee
       FROM students s
       INNER JOIN terms t ON t.id = $2 AND t.tenant_id = $1
       INNER JOIN classes c_student ON c_student.id = s.class_assigned_id AND c_student.tenant_id = s.tenant_id
       INNER JOIN ledger_fee_structures fs ON fs.id = $3 AND fs.tenant_id = s.tenant_id
       INNER JOIN classes c_fs ON c_fs.id = fs.class_id AND c_fs.tenant_id = fs.tenant_id
       WHERE s.tenant_id = $1
         AND COALESCE(s.enrollment_status, 'active') = 'active'
         AND s.class_assigned_id IS NOT NULL
         AND ${SQL_FEE_STRUCTURE_CLASS_MATCH}
       ORDER BY s.id
     ) sub
     WHERE sl.tenant_id = $1
       AND sl.student_id = sub.student_id
       AND sl.term_id = $2
       AND sl.entry_type = 'term_fee'`,
    [tenantId, termId, feeStructureId]
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
      await syncLedgerDebitsForStructure(tenantId, feeStructureId);
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
