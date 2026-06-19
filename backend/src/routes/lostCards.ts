import express from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { requireTenant } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  getLostCardReport,
  listLostCardReports,
  getUnreadLostCardNotifications,
  markLostCardNotificationRead,
  buildReportTimeline,
} from '../services/lostCardService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

router.get('/notifications/unread', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const items = await getUnreadLostCardNotifications(tenantId);
    res.json({ items, count: items.length });
  } catch (error) {
    console.error('Lost card notifications error:', error);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

router.post('/notifications/:id/read', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    await markLostCardNotificationRead(id, tenantId);
    res.json({ ok: true });
  } catch (error) {
    console.error('Mark lost card notification read error:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

router.get('/reports', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const items = await listLostCardReports(tenantId);
    res.json({ items });
  } catch (error) {
    console.error('List lost card reports error:', error);
    res.status(500).json({ error: 'Failed to load reports' });
  }
});

router.get('/reports/:reportId', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const report = await getLostCardReport(req.params.reportId, tenantId);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({
      report,
      timeline: buildReportTimeline(report),
    });
  } catch (error) {
    console.error('Get lost card report error:', error);
    res.status(500).json({ error: 'Failed to load report' });
  }
});

export default router;
