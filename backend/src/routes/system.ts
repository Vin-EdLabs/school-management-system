import express from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import {
  captureSystemError,
  getSystemHealthSummary,
  listSystemErrors,
  updateSystemErrorStatus,
} from '../services/systemErrorService.js';

const router = express.Router();

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
    const errors = await listSystemErrors({
      tenantId: req.query.tenantId as string,
      source: req.query.source as string,
      status: req.query.status as string,
      severity: req.query.severity as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      search: req.query.search as string,
      limit: req.query.limit ? Number(req.query.limit) : 200,
    });
    res.json(errors);
  } catch (error) {
    console.error('List system errors failed:', error);
    res.status(500).json({ error: 'Failed to load system errors' });
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
