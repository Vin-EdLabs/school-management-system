import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { listActiveSessionsForSuperAdmin } from '../services/presenceService.js';
import {
  getDailyUsage,
  getHourlyUsageToday,
  getUsageSummary,
} from '../services/platformUsageService.js';
import {
  getPlatformUiSettings,
  updatePlatformUiSettings,
} from '../services/platformSettingsService.js';

const router = express.Router();

/** Live staff sessions — neutral URL path (avoids ad-blocker flags on /audit/). */
router.get('/live-users', authenticate, requireRole('super-admin'), async (_req: AuthRequest, res) => {
  try {
    const sessions = await listActiveSessionsForSuperAdmin();

    const tenantIds = Array.from(
      new Set(
        sessions
          .filter((s) => typeof s.tenantId === 'number' && !Number.isNaN(s.tenantId))
          .map((s) => s.tenantId as number)
      )
    );
    const tenantNames = new Map<number, string>();
    if (tenantIds.length > 0) {
      const tenantRows = await query(`SELECT id, name FROM tenants WHERE id = ANY($1::int[])`, [tenantIds]);
      tenantRows.rows.forEach((row: { id: number; name: string }) => {
        tenantNames.set(row.id, row.name);
      });
    }

    const payload = sessions.map((session) => ({
      ...session,
      tenantName: session.tenantId ? tenantNames.get(session.tenantId) ?? `School #${session.tenantId}` : 'Platform',
      durationSeconds: session.connectedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(session.connectedAt).getTime()) / 1000))
        : null,
    }));

    res.json(payload);
  } catch (error) {
    console.error('Get live users error:', error);
    res.status(500).json({ error: 'Failed to fetch live users' });
  }
});

router.get('/usage/daily', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const days = parseInt(String(req.query.days || '30'), 10);
    const rows = await getDailyUsage(days);
    res.json(rows);
  } catch (error) {
    console.error('Get daily usage error:', error);
    res.status(500).json({ error: 'Failed to fetch daily usage' });
  }
});

router.get('/usage/hourly-today', authenticate, requireRole('super-admin'), async (_req: AuthRequest, res) => {
  try {
    const rows = await getHourlyUsageToday();
    res.json(rows);
  } catch (error) {
    console.error('Get hourly usage error:', error);
    res.status(500).json({ error: 'Failed to fetch hourly usage' });
  }
});

router.get('/usage/summary', authenticate, requireRole('super-admin'), async (_req: AuthRequest, res) => {
  try {
    const summary = await getUsageSummary();
    res.json(summary);
  } catch (error) {
    console.error('Get usage summary error:', error);
    res.status(500).json({ error: 'Failed to fetch usage summary' });
  }
});

router.get('/settings', authenticate, requireRole('super-admin'), async (_req: AuthRequest, res) => {
  try {
    const ui = await getPlatformUiSettings();
    res.json({ ui });
  } catch (error) {
    console.error('Get platform settings error:', error);
    res.status(500).json({ error: 'Failed to fetch platform settings' });
  }
});

router.patch('/settings', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    const ui = await updatePlatformUiSettings(
      {
        zoomNudgeEnabled:
          body.zoomNudgeEnabled !== undefined ? Boolean(body.zoomNudgeEnabled) : undefined,
      },
      req.user?.id ?? null
    );
    res.json({ ui });
  } catch (error) {
    console.error('Update platform settings error:', error);
    res.status(500).json({ error: 'Failed to update platform settings' });
  }
});

router.put('/settings', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    const ui = await updatePlatformUiSettings(
      {
        zoomNudgeEnabled:
          body.zoomNudgeEnabled !== undefined ? Boolean(body.zoomNudgeEnabled) : undefined,
      },
      req.user?.id ?? null
    );
    res.json({ ui });
  } catch (error) {
    console.error('Update platform settings error:', error);
    res.status(500).json({ error: 'Failed to update platform settings' });
  }
});

export default router;
