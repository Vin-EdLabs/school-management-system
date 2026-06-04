import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

router.post('/visit', async (req, res) => {
  try {
    const { visitorId, page } = req.body || {};

    if (page !== 'landing') {
      return res.status(204).send();
    }

    if (typeof visitorId !== 'string' || visitorId.trim().length < 12) {
      return res.status(400).json({ error: 'Valid visitorId is required' });
    }

    await query(
      `INSERT INTO visits (visitor_id, page)
       VALUES ($1, $2)
       ON CONFLICT (visitor_id) DO NOTHING`,
      [visitorId.trim(), 'landing']
    );

    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Register visit error:', error);
    res.status(500).json({ error: 'Failed to register visit' });
  }
});

router.get('/stats/visits', authenticate, requireRole('super-admin'), async (_req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT COUNT(*)::int AS landing_visitors
       FROM visits
       WHERE page = 'landing'`
    );

    res.json({ landingVisitors: Number(result.rows[0]?.landing_visitors ?? 0) });
  } catch (error) {
    console.error('Visit stats error:', error);
    res.status(500).json({ error: 'Failed to load visit stats' });
  }
});

export default router;
