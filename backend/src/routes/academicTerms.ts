import express from 'express';
import { authenticate, requireTenant, AuthRequest, requirePrimaryAdminOrSuperAdmin } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { activateAcademicTerm } from '../services/termActivationService.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
  } catch {
    /* socket optional */
  }
};

/** POST /api/academic-terms/:id/activate — full term transition in one transaction */
router.post('/:id/activate', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const termId = parseInt(String(req.params.id), 10);
    if (!termId || Number.isNaN(termId)) {
      return res.status(400).json({ error: 'Invalid academic term id' });
    }

    const result = await activateAcademicTerm(tenantId, termId);

    if (result.success) {
      emitTenantDataChanged(tenantId, 'academic-term', 'updated');
      emitTenantDataChanged(tenantId, 'settings', 'updated');
      emitTenantDataChanged(tenantId, 'finance-term-switch', 'updated');
      emitTenantDataChanged(tenantId, 'fee', 'updated');
      emitTenantDataChanged(tenantId, 'finance', 'updated');

      const carryStep = result.steps.find((s) => s.key === 'carry_forward');
      await writeAuditLog({
        tenantId,
        userId: req.user!.id,
        userRole: req.user!.role,
        action: 'TERM_ACTIVATED',
        entityType: 'ACADEMIC_TERM',
        entityId: termId,
        module: 'finance',
        status: 'success',
        summary: `Activated ${result.termName} ${result.academicYear}`,
        details: {
          termName: result.termName,
          academicYear: result.academicYear,
          steps: result.steps,
          carryForward: carryStep?.details,
        },
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || null,
      });
    }

    return res.json(result);
  } catch (error: any) {
    console.error('[academic-terms/activate] error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to activate academic term',
      steps: [],
    });
  }
});

export default router;
