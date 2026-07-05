import express from 'express';
import { authenticate, requireTenant, requireRole, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  loadGradeConfigForTenant,
  saveGradeConfigForTenant,
  type GradeConfigPayload,
} from '../services/gradeConfigService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const role = String(req.user!.role || '').toLowerCase();
    if (role === 'finance') {
      return res.status(403).json({ error: 'Finance staff cannot access grade configuration' });
    }
    const loaded = await loadGradeConfigForTenant(tenantId);
    res.json(loaded);
  } catch (error: any) {
    console.error('GET grade-config error:', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Failed to load grade config' });
  }
});

router.put('/', requireRole('super-admin', 'administrator', 'headmaster'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const body = req.body as GradeConfigPayload;
    const loaded = await saveGradeConfigForTenant(tenantId, body);
    res.json(loaded);
  } catch (error: any) {
    console.error('PUT grade-config error:', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Failed to save grade config' });
  }
});

export default router;
