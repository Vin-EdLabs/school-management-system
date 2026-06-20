import express from 'express';
import { authenticate, requireRole, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import {
  bulkPromoteStudents,
  listClassStudentsForPromotion,
  listPromotionHistory,
} from '../services/promotionService.js';

const router = express.Router();

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
  } catch {
    /* ignore */
  }
};

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

router.get('/class/:classId/students', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const classId = parseInt(req.params.classId, 10);
    if (Number.isNaN(classId)) return res.status(400).json({ error: 'Invalid class id' });
    const data = await listClassStudentsForPromotion(tenantId, classId);
    if (!data) return res.status(404).json({ error: 'Class not found' });
    res.json(data);
  } catch (error) {
    console.error('List class students for promotion error:', error);
    res.status(500).json({ error: 'Failed to load students' });
  }
});

router.get('/history', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const rows = await listPromotionHistory(tenantId);
    res.json(rows);
  } catch (error) {
    console.error('Promotion history error:', error);
    res.status(500).json({ error: 'Failed to load promotion history' });
  }
});

router.post('/bulk', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentIds = Array.isArray(req.body?.studentIds)
      ? req.body.studentIds.map((id: unknown) => parseInt(String(id), 10)).filter((n: number) => !Number.isNaN(n))
      : [];
    const fromClassId = parseInt(String(req.body?.fromClassId), 10);
    const rawTo = req.body?.toClassId;
    const toClassId =
      rawTo === 'GRADUATE' || rawTo === 'graduate' ? ('GRADUATE' as const) : parseInt(String(rawTo), 10);
    const academicYear = String(req.body?.academicYear || '').trim();

    if (!studentIds.length) return res.status(400).json({ error: 'studentIds required' });
    if (Number.isNaN(fromClassId)) return res.status(400).json({ error: 'fromClassId required' });
    if (toClassId !== 'GRADUATE' && Number.isNaN(toClassId)) {
      return res.status(400).json({ error: 'toClassId required' });
    }

    const result = await bulkPromoteStudents({
      tenantId,
      promotedBy: req.user!.id,
      studentIds,
      fromClassId,
      toClassId,
      academicYear,
    });

    emitTenantDataChanged(tenantId, 'student', 'updated');
    res.json(result);
  } catch (error: unknown) {
    console.error('Bulk promote error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Promotion failed' });
  }
});

export default router;
