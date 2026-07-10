import express from 'express';
import { authenticate, requireTenant, AuthRequest, requirePrimaryAdminOrSuperAdmin } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { activateAcademicTerm } from '../services/termActivationService.js';
import { closeTermAndActivateNext, getTermClosePreview } from '../services/termCloseService.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import { formatMoneyGhs, resolveActorFromRequest } from '../utils/auditResolve.js';

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

/** GET /api/academic-terms/:id/closed-record — view snapshot / fee archive for a term */
router.get('/:id/closed-record', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const termId = parseInt(String(req.params.id), 10);
    if (!termId || Number.isNaN(termId)) {
      return res.status(400).json({ error: 'Invalid academic term id' });
    }
    const { getClosedAcademicTermRecord } = await import('../services/closedTermViewService.js');
    const record = await getClosedAcademicTermRecord(tenantId, termId);
    if (!record) {
      return res.status(404).json({ error: 'Academic term not found' });
    }
    res.set('Cache-Control', 'no-store');
    return res.json(record);
  } catch (error: any) {
    console.error('[academic-terms/closed-record] error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to load term record' });
  }
});

/** GET /api/academic-terms/:id/close-preview — summary before closing */
router.get('/:id/close-preview', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const termId = parseInt(String(req.params.id), 10);
    if (!termId || Number.isNaN(termId)) {
      return res.status(400).json({ error: 'Invalid academic term id' });
    }
    const preview = await getTermClosePreview(tenantId, termId);
    return res.json(preview);
  } catch (error: any) {
    console.error('[academic-terms/close-preview] error:', error);
    return res.status(400).json({ error: error?.message || 'Failed to load close preview' });
  }
});

/** POST /api/academic-terms/:id/close — permanently close active term and activate next */
router.post('/:id/close', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const termId = parseInt(String(req.params.id), 10);
    if (!termId || Number.isNaN(termId)) {
      return res.status(400).json({ error: 'Invalid academic term id' });
    }

    const result = await closeTermAndActivateNext(tenantId, termId, req.user!.id);

    emitTenantDataChanged(tenantId, 'academic-term', 'updated');
    emitTenantDataChanged(tenantId, 'settings', 'updated');
    emitTenantDataChanged(tenantId, 'finance-term-switch', 'updated');
    emitTenantDataChanged(tenantId, 'finance-term-closed', 'updated');
    emitTenantDataChanged(tenantId, 'fee', 'updated');
    emitTenantDataChanged(tenantId, 'finance', 'updated');

    const actor = await resolveActorFromRequest(req);
    const summary =
      `Term closed permanently — ${result.closedTermLabel} by ${actor}. ` +
      `Snapshot: ${result.totalStudents} students, ${formatMoneyGhs(result.totalCollected)} collected, ` +
      `${formatMoneyGhs(result.totalOutstanding)} outstanding, ` +
      `${formatMoneyGhs(result.totalCredits)} credits carried forward` +
      (result.nextTermLabel ? ` to ${result.nextTermLabel}` : '') +
      '.';

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'TERM_CLOSED',
      entityType: 'ACADEMIC_TERM',
      entityId: termId,
      module: 'finance',
      status: 'success',
      summary,
      details: result,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    return res.json(result);
  } catch (error: any) {
    console.error('[academic-terms/close] error:', error);
    return res.status(400).json({
      success: false,
      error: error?.message || 'Failed to close term',
    });
  }
});

export default router;
