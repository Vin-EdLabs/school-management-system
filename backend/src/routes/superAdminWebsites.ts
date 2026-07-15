/**
 * Super Admin — School Website feature controls
 */
import express from 'express';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import {
  listSuperAdminWebsites,
  listSuperAdminWebsiteEnableRequests,
  superAdminSetWebsiteEnabled,
  superAdminSetWebsiteSubdomain,
  superAdminWebsiteStats,
} from '../services/schoolWebsiteService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole('super-admin'));

function handleError(res: express.Response, err: unknown) {
  const status = (err as { status?: number })?.status || 500;
  const message = err instanceof Error ? err.message : 'Request failed';
  if (status >= 500) console.error('Super admin website error:', err);
  return res.status(status).json({ error: message });
}

router.get('/', async (_req: AuthRequest, res) => {
  try {
    const [schools, stats, enable_requests] = await Promise.all([
      listSuperAdminWebsites(),
      superAdminWebsiteStats(),
      listSuperAdminWebsiteEnableRequests(),
    ]);
    res.json({ schools, stats, enable_requests });
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/:tenantId/enabled', async (req: AuthRequest, res) => {
  try {
    const tenantId = Number(req.params.tenantId);
    if (!Number.isFinite(tenantId)) return res.status(400).json({ error: 'Invalid tenant ID' });
    const enabled = req.body.enabled === true;
    res.json(await superAdminSetWebsiteEnabled(tenantId, enabled));
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/:tenantId/subdomain', async (req: AuthRequest, res) => {
  try {
    const tenantId = Number(req.params.tenantId);
    if (!Number.isFinite(tenantId)) return res.status(400).json({ error: 'Invalid tenant ID' });
    const subdomain =
      req.body.subdomain === null || req.body.subdomain === undefined
        ? null
        : String(req.body.subdomain);
    res.json(await superAdminSetWebsiteSubdomain(tenantId, subdomain));
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
