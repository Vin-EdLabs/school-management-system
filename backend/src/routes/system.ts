import express from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import {
  captureSystemError,
  clearSystemErrors,
  getSystemHealthSummary,
  listSystemErrors,
  updateSystemErrorStatus,
} from '../services/systemErrorService.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import { getPlatformUiSettings } from '../services/platformSettingsService.js';

const router = express.Router();

/** Public UI flags — no auth; used by all staff browsers for zoom nudge, etc. */
router.get('/public-ui-config', async (_req, res) => {
  try {
    const ui = await getPlatformUiSettings();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ui });
  } catch (error) {
    console.error('Public UI config error:', error);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ui: { zoomNudgeEnabled: false } });
  }
});

router.post('/errors/report', async (req, res) => {
  try {
    const body = req.body || {};
    const message = String(body.message || '').trim();
    if (!message || message.length > 4000) {
      return res.status(400).json({ error: 'Valid message is required' });
    }

    await captureSystemError({
      message,
      stack: body.stack || null,
      source: body.source || 'frontend',
      tenantId: body.tenantId ? Number(body.tenantId) : null,
      userId: body.userId ? Number(body.userId) : null,
      endpoint: body.endpoint || null,
      action: body.action || null,
      severity: body.severity || 'warning',
      metadata: body.metadata || null,
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Report system error failed:', error);
    res.status(500).json({ error: 'Failed to report error' });
  }
});

/** UI flags for authenticated staff apps (zoom nudge, etc.). */
router.get('/ui-config', authenticate, async (_req: AuthRequest, res) => {
  try {
    const ui = await getPlatformUiSettings();
    res.json({ ui });
  } catch (error) {
    console.error('UI config error:', error);
    res.status(500).json({ error: 'Failed to load UI config' });
  }
});

router.get('/health', authenticate, requireRole('super-admin'), async (_req: AuthRequest, res) => {
  try {
    const health = await getSystemHealthSummary();
    res.json(health);
  } catch (error) {
    console.error('System health error:', error);
    res.status(500).json({ error: 'Failed to load system health' });
  }
});

router.get('/errors', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const result = await listSystemErrors({
      tenantId: req.query.tenantId as string,
      source: req.query.source as string,
      status: req.query.status as string,
      severity: req.query.severity as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      search: req.query.search as string,
      limit: req.query.limit ? Number(req.query.limit) : 25,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    res.json(result);
  } catch (error) {
    console.error('List system errors failed:', error);
    res.status(500).json({ error: 'Failed to load system errors' });
  }
});

router.delete('/errors/clear', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const deleted = await clearSystemErrors({
      tenantId: req.query.tenantId as string,
      source: req.query.source as string,
      status: req.query.status as string,
      severity: req.query.severity as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      search: req.query.search as string,
    });

    await writeAuditLog({
      tenantId: null,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'SYSTEM_ERRORS_CLEARED',
      entityType: 'system_error',
      module: 'superadmin',
      summary: `Cleared ${deleted} system error(s)`,
      details: { deleted, filters: req.query },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    res.json({ deleted });
  } catch (error) {
    console.error('Clear system errors failed:', error);
    res.status(500).json({ error: 'Failed to clear system errors' });
  }
});

router.patch('/errors/:id/status', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').toLowerCase();
    if (!['resolved', 'ignored', 'new'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updated = await updateSystemErrorStatus(id, status as 'resolved' | 'ignored' | 'new');
    if (!updated) return res.status(404).json({ error: 'Error not found' });
    res.json(updated);
  } catch (error) {
    console.error('Update system error status failed:', error);
    res.status(500).json({ error: 'Failed to update error status' });
  }
});

export default router;
