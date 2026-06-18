import express from 'express';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import {
  createStudentCharge,
  deleteStudentCharge,
  listStudentCharges,
} from '../services/studentChargesService.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from '../services/auditService.js';
import { formatMoneyGhs, resolveActorFromRequest, resolveStudentLabel, withActor } from '../utils/auditResolve.js';
import { getClientIp } from '../utils/clientIp.js';

const router = express.Router();

const financeRoles = requireRole('super-admin', 'administrator', 'finance');

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
attachWritableTermGuard(router);

/** POST /api/finance/student-charges */
router.post('/', financeRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const userId = req.user!.id;
    const { student_id, description, amount, reason } = req.body ?? {};

    const studentId = parseInt(String(student_id), 10);
    if (Number.isNaN(studentId)) {
      return res.status(400).json({ error: 'Valid student_id is required.' });
    }

    const charge = await createStudentCharge({
      tenantId,
      studentId,
      description: String(description || ''),
      amount: Number(amount),
      reason: reason != null ? String(reason) : null,
      createdByUserId: userId,
    });

    emitTenantDataChanged(tenantId, 'fee', 'created');
    emitTenantDataChanged(tenantId, 'finance', 'updated');

    const studentLabel = await resolveStudentLabel(tenantId, studentId);
    await writeAuditLog({
      tenantId,
      userId,
      action: 'created',
      entityType: 'student_charge',
      entityId: charge.id,
      summary: withActor(
        `Added individual charge of ${formatMoneyGhs(charge.amount)} for ${studentLabel}: ${charge.description}`,
        await resolveActorFromRequest(req)
      ),
      ipAddress: getClientIp(req),
    }).catch(() => {});

    res.status(201).json(charge);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create charge';
    console.error('Create student charge error:', error);
    res.status(400).json({ error: message });
  }
});

/** GET /api/finance/student-charges/student/:studentId */
router.get('/student/:studentId', financeRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentId = parseInt(String(req.params.studentId), 10);
    if (Number.isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const termIdRaw = req.query.term_id;
    const termId =
      termIdRaw != null && String(termIdRaw).trim() !== ''
        ? parseInt(String(termIdRaw), 10)
        : null;

    const charges = await listStudentCharges(
      tenantId,
      studentId,
      termId != null && !Number.isNaN(termId) ? termId : null
    );
    res.json(charges);
  } catch (error) {
    console.error('List student charges error:', error);
    res.status(500).json({ error: 'Failed to load student charges' });
  }
});

/** DELETE /api/finance/student-charges/:chargeId — admin only */
router.delete(
  '/:chargeId',
  requireRole('super-admin', 'administrator', 'finance'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const chargeId = parseInt(String(req.params.chargeId), 10);
      if (Number.isNaN(chargeId)) {
        return res.status(400).json({ error: 'Invalid charge id' });
      }

      await deleteStudentCharge(tenantId, chargeId);

      emitTenantDataChanged(tenantId, 'fee', 'deleted');
      emitTenantDataChanged(tenantId, 'finance', 'updated');

      await writeAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'deleted',
        entityType: 'student_charge',
        entityId: chargeId,
        summary: withActor(
          `Removed individual student charge #${chargeId}`,
          await resolveActorFromRequest(req)
        ),
        ipAddress: getClientIp(req),
      }).catch(() => {});

      res.json({ message: 'Charge removed successfully.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete charge';
      console.error('Delete student charge error:', error);
      res.status(400).json({ error: message });
    }
  }
);

export default router;
