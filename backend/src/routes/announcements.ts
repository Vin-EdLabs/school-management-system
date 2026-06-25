import express, { Response } from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, requireRole, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import {
  getUnreadAnnouncementsForUser,
  markAnnouncementRead,
} from '../services/globalAnnouncementService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);
router.use(requireRole('administrator', 'finance', 'headmaster'));

import { resolveSchoolDisplayName } from '../services/schoolBrandingService.js';

async function resolveSchoolName(tenantId: number): Promise<string> {
  return resolveSchoolDisplayName(tenantId);
}

router.get('/unread', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    if (tenantId == null) return res.status(400).json({ error: 'Tenant context required' });

    const schoolName = await resolveSchoolName(tenantId);
    const items = await getUnreadAnnouncementsForUser(req.user!.id, tenantId, schoolName);
    res.json({ items, schoolName });
  } catch (error) {
    console.error('Unread announcements error:', error);
    res.status(500).json({ error: 'Failed to load announcements' });
  }
});

router.post('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    if (tenantId == null) return res.status(400).json({ error: 'Tenant context required' });

    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const ok = await markAnnouncementRead(id, req.user!.id, tenantId);
    if (!ok) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Mark announcement read error:', error);
    res.status(500).json({ error: 'Failed to mark announcement as read' });
  }
});

export default router;
