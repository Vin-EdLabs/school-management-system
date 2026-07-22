import express from 'express';
import { query } from '../db/connection.js';
import { authenticateParent, ParentAuthRequest } from '../middleware/authenticateParent.js';
import { getTenantPaystackConfig } from '../services/paystackService.js';
import {
  initializeOnlinePayment,
  publicParentPaystackConfig,
  verifyOnlinePayment,
} from '../services/onlinePaymentService.js';

const router = express.Router();

const parentInitRate = new Map<number, number[]>();

function rateLimitParentInit(req: ParentAuthRequest, res: express.Response, next: express.NextFunction) {
  const tenantId = req.parent?.tenantId;
  if (!tenantId) return next();
  const now = Date.now();
  const hits = (parentInitRate.get(tenantId) || []).filter((t) => now - t < 60_000);
  if (hits.length >= 10) {
    return res.status(429).json({ error: 'Too many payment attempts. Please wait a minute.' });
  }
  hits.push(now);
  parentInitRate.set(tenantId, hits);
  next();
}

async function assertParentStudentAccess(req: ParentAuthRequest, studentId: number): Promise<boolean> {
  const tenantId = req.parent!.tenantId;
  const accountId = req.parent!.accountId;
  const res = await query(
    `SELECT s.id FROM students s
      JOIN parent_portal_accounts pa ON pa.student_id = s.id AND pa.tenant_id = s.tenant_id
     WHERE s.id = $1 AND s.tenant_id = $2 AND pa.id = $3
     LIMIT 1`,
    [studentId, tenantId, accountId]
  );
  if (res.rows.length > 0) return true;

  const familyRes = await query(
    `SELECT s.id FROM students s
      JOIN parent_portal_accounts anchor ON anchor.id = $3 AND anchor.tenant_id = $2
      JOIN parent_portal_accounts sibling ON sibling.family_group_id = anchor.family_group_id
        AND sibling.tenant_id = anchor.tenant_id AND sibling.student_id = s.id
     WHERE s.id = $1 AND s.tenant_id = $2
     LIMIT 1`,
    [studentId, tenantId, accountId]
  );
  return familyRes.rows.length > 0;
}

/** GET /api/parent/payments/online-config */
router.get('/online-config', authenticateParent, async (req: ParentAuthRequest, res) => {
  try {
    const tenantId = req.parent!.tenantId;
    const config = await getTenantPaystackConfig(tenantId);
    return res.json({ config: await publicParentPaystackConfig(config) });
  } catch (error) {
    console.error('Parent online config error:', error);
    return res.status(500).json({ error: 'Failed to load online payment settings' });
  }
});

/** POST /api/parent/payments/initialize */
router.post('/initialize', authenticateParent, rateLimitParentInit, async (req: ParentAuthRequest, res) => {
  try {
    const tenantId = req.parent!.tenantId;
    const studentId = parseInt(String(req.body?.student_id ?? req.body?.studentId), 10);
    const amount = Number(req.body?.amount);
    const email = req.body?.email ? String(req.body.email) : null;
    const callbackUrl = req.body?.callbackUrl ? String(req.body.callbackUrl) : undefined;

    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Valid student is required' });
    }

    const allowed = await assertParentStudentAccess(req, studentId);
    if (!allowed) {
      return res.status(403).json({ error: 'You cannot pay for this student' });
    }

    const result = await initializeOnlinePayment({
      tenantId,
      studentId,
      amountGhs: amount,
      email,
      callbackUrl,
      initiatedBy: 'parent',
    });

    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to start payment';
    return res.status(400).json({ error: message });
  }
});

/** GET /api/parent/payments/verify/:reference */
router.get('/verify/:reference', authenticateParent, async (req: ParentAuthRequest, res) => {
  try {
    const tenantId = req.parent!.tenantId;
    const reference = String(req.params.reference || '');
    if (!reference.startsWith(`SN-${tenantId}-`)) {
      return res.status(403).json({ error: 'Invalid payment reference' });
    }
    const result = await verifyOnlinePayment(reference);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    return res.status(400).json({ error: message });
  }
});

export default router;
