import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { listActiveSessionsForSuperAdmin } from '../services/presenceService.js';

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

export default router;
