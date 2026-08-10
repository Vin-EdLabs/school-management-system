import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { getIO } from '../socket.js';
import { resolveActiveLedgerTerm } from '../services/studentUnifiedBalanceService.js';
import { voidAllUnpaidBoardingFeesForTenant } from '../services/boardingFeeService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole('super-admin'));

// PATCH /api/super-admin/schools/:schoolId/toggle-boarding
router.patch('/schools/:schoolId/toggle-boarding', async (req: AuthRequest, res) => {
  try {
    const schoolId = parseInt(req.params.schoolId, 10);
    if (!schoolId) return res.status(400).json({ error: 'Invalid school id' });

    const { enabled } = req.body ?? {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled (boolean) is required' });
    }

    const result = await query(
      `UPDATE tenants SET boarding_enabled = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, slug, subdomain, logo_url, primary_color, secondary_color,
                 subscription_status, is_active, is_demo, archived_at, boarding_enabled,
                 created_at, updated_at`,
      [enabled, schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const school = result.rows[0];

    if (!enabled) {
      try {
        const { ledgerTermId } = await resolveActiveLedgerTerm(query, schoolId);
        if (ledgerTermId) {
          await voidAllUnpaidBoardingFeesForTenant(schoolId, ledgerTermId, req.user?.id ?? null);
        }
      } catch (voidErr) {
        console.error('Void unpaid boarding fees on disable:', voidErr);
      }
    }

    try {
      const io = getIO();
      const payload = {
        tenantId: schoolId,
        entity: 'boarding-module',
        action: enabled ? 'enabled' : 'disabled',
        boarding_enabled: enabled,
        at: Date.now(),
      };
      io.to(`tenant:${schoolId}`).emit('tenant-data-changed', payload);
      io.to('global:general').emit('tenant-data-changed', payload);
      io.to('global:super-admin').emit('tenant-data-changed', payload);
    } catch {
      // Socket optional
    }

    res.json(school);
  } catch (error) {
    console.error('Toggle boarding error:', error);
    res.status(500).json({ error: 'Failed to update boarding module' });
  }
});

export default router;
