import express from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from '../services/auditService.js';
import { notifySetupProgressChanged } from '../services/setupProgressService.js';
import {
  createAcademicYear,
  executeYearEnd,
  listAcademicYears,
  previewYearEnd,
} from '../services/academicYearEndService.js';

const router = express.Router({ mergeParams: true });

function emitChanged(tenantId: number) {
  try {
    getIO().to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: 'academic-year',
      action: 'updated',
      at: Date.now(),
    });
  } catch {
    // ignore
  }
}

function parseSchoolId(req: AuthRequest): number {
  const raw = req.params.schoolId;
  const id = parseInt(String(raw), 10);
  if (!id || Number.isNaN(id)) throw new Error('Invalid school id');
  return id;
}

function assertSchoolScope(req: AuthRequest, schoolId: number) {
  const role = req.user?.role;
  if (role === 'super-admin') return;
  if (req.user?.tenantId !== schoolId) {
    const err = new Error('Cross-tenant access denied');
    (err as any).status = 403;
    throw err;
  }
}

router.use(authenticate);
router.use(requireRole('super-admin', 'administrator'));
router.use(setTenantContext);
attachWritableTermGuard(router);

router.get('/:schoolId/academic-years', async (req: AuthRequest, res) => {
  try {
    const schoolId = parseSchoolId(req);
    assertSchoolScope(req, schoolId);
    const years = await listAcademicYears(req.user!.tenantId ?? schoolId, schoolId);
    return res.json({ years });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || 'Failed to list academic years' });
  }
});

router.post('/:schoolId/academic-years', async (req: AuthRequest, res) => {
  try {
    const schoolId = parseSchoolId(req);
    assertSchoolScope(req, schoolId);
    const { name, startDate, endDate } = req.body || {};
    const year = await createAcademicYear(req.user!.tenantId ?? schoolId, schoolId, {
      name: String(name || ''),
      startDate,
      endDate,
    });
    emitChanged(schoolId);
    notifySetupProgressChanged(schoolId);
    return res.status(201).json({ year });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to create academic year' });
  }
});

router.post('/:schoolId/academic-year/preview', async (req: AuthRequest, res) => {
  try {
    const schoolId = parseSchoolId(req);
    assertSchoolScope(req, schoolId);
    const currentYearId = Number(req.body?.current_year_id);
    if (!currentYearId) {
      return res.status(400).json({ error: 'current_year_id is required' });
    }
    const preview = await previewYearEnd(req.user!.tenantId ?? schoolId, schoolId, currentYearId);
    return res.json(preview);
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to preview year end' });
  }
});

router.post('/:schoolId/academic-year/end', async (req: AuthRequest, res) => {
  try {
    const schoolId = parseSchoolId(req);
    assertSchoolScope(req, schoolId);
    const currentYearId = Number(req.body?.current_year_id);
    const newYearId = Number(req.body?.new_year_id);
    if (!currentYearId || !newYearId) {
      return res.status(400).json({ error: 'current_year_id and new_year_id are required' });
    }
    const result = await executeYearEnd(
      req.user!.tenantId ?? schoolId,
      schoolId,
      currentYearId,
      newYearId
    );
    await writeAuditLog({
      tenantId: schoolId,
      userId: req.user!.id,
      action: 'year_end_execute',
      entityType: 'academic_year',
      entityId: newYearId,
      summary: `End of year: ${result.graduated} graduated, ${result.promoted} promoted, ${result.repeated} repeated`,
      details: { ...result },
    });
    emitChanged(schoolId);
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to execute year end' });
  }
});

export default router;
