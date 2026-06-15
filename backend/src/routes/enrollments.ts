import express from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { requireTenant } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import {
  getCurrentAcademicYearId,
  getEnrollmentsForYear,
  markEnrollmentRepeat,
  unmarkEnrollmentRepeat,
} from '../services/academicYearEndService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const academicYearId = Number(req.query.academicYearId) || (await getCurrentAcademicYearId(tenantId));
    if (!academicYearId) {
      return res.json({ enrollments: [], academicYearId: null });
    }
    const classId = req.query.classId ? Number(req.query.classId) : undefined;
    const enrollments = await getEnrollmentsForYear(tenantId, academicYearId, classId);
    return res.json({ enrollments, academicYearId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch enrollments' });
  }
});

router.patch('/:id/mark-repeat', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const enrollmentId = Number(req.params.id);
    const result = await markEnrollmentRepeat(tenantId, enrollmentId);
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to mark repeat' });
  }
});

router.patch('/:id/unmark-repeat', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const enrollmentId = Number(req.params.id);
    const result = await unmarkEnrollmentRepeat(tenantId, enrollmentId);
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to unmark repeat' });
  }
});

export default router;
