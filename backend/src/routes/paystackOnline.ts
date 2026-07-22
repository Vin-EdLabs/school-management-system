import express, { Request, Response } from 'express';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  getTenantPaystackConfig,
  koboToGhs,
} from '../services/paystackService.js';
import {
  initializeOnlinePayment,
  listOnlinePayments,
  publicPaystackConfig,
  publicParentPaystackConfig,
  upsertTenantPaystackConfig,
  verifyOnlinePayment,
} from '../services/onlinePaymentService.js';

const router = express.Router();

const financeRoles = requireRole('super-admin', 'administrator', 'finance');
const settingsRoles = requireRole('super-admin', 'administrator');

const initRateMap = new Map<number, number[]>();
function rateLimitInitialize(req: AuthRequest, res: Response, next: () => void) {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return next();
  const now = Date.now();
  const windowMs = 60_000;
  const max = 10;
  const hits = (initRateMap.get(tenantId) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    return res.status(429).json({ error: 'Too many payment attempts. Please wait a minute.' });
  }
  hits.push(now);
  initRateMap.set(tenantId, hits);
  next();
}

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

/** GET /api/payments/config */
router.get('/config', financeRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const config = await getTenantPaystackConfig(tenantId);
    return res.json({ config: await publicPaystackConfig(config) });
  } catch (error) {
    console.error('Paystack config GET error:', error);
    return res.status(500).json({ error: 'Failed to load payment config' });
  }
});

/** POST /api/payments/config */
router.post('/config', settingsRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const {
      enabled, mode, feeBearer, subaccountCode, payoutAccount, ownPublicKey, ownSecretKey,
    } = req.body || {};

    if (mode !== 'scholarnerve' && mode !== 'own') {
      return res.status(400).json({ error: 'Invalid payment mode' });
    }
    if (feeBearer && feeBearer !== 'parent' && feeBearer !== 'school') {
      return res.status(400).json({ error: 'Invalid fee bearer' });
    }

    const saved = await upsertTenantPaystackConfig({
      tenantId,
      enabled: Boolean(enabled),
      mode,
      feeBearer: feeBearer === 'school' ? 'school' : 'parent',
      subaccountCode: subaccountCode ?? null,
      payoutAccount: payoutAccount ?? null,
      ownPublicKey: ownPublicKey ?? null,
      ownSecretKey: ownSecretKey ?? null,
    });

    return res.json({ config: await publicPaystackConfig(saved) });
  } catch (error) {
    console.error('Paystack config POST error:', error);
    return res.status(500).json({ error: 'Failed to save payment config' });
  }
});

/** POST /api/payments/initialize — staff-initiated (optional) */
router.post('/initialize', financeRoles, rateLimitInitialize, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentId = parseInt(String(req.body?.student_id ?? req.body?.studentId), 10);
    const amount = Number(req.body?.amount);
    const email = req.body?.email ? String(req.body.email) : null;

    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Valid student_id is required' });
    }

    const result = await initializeOnlinePayment({
      tenantId,
      studentId,
      amountGhs: amount,
      email,
      initiatedBy: 'admin',
    });

    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to initialize payment';
    return res.status(400).json({ error: message });
  }
});

/** GET /api/payments/verify/:reference */
router.get('/verify/:reference', financeRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const reference = String(req.params.reference || '');
    const result = await verifyOnlinePayment(reference);

    const txTenantCheck = reference.match(/^SN-(\d+)-/);
    if (!txTenantCheck || Number(txTenantCheck[1]) !== tenantId) {
      return res.status(403).json({ error: 'Payment does not belong to this school' });
    }

    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    return res.status(400).json({ error: message });
  }
});

/** GET /api/payments/transactions — admin online payments list */
router.get('/transactions', financeRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await listOnlinePayments(tenantId, {
      status: req.query.status ? String(req.query.status) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      from: req.query.from ? String(req.query.from) : undefined,
      to: req.query.to ? String(req.query.to) : undefined,
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : 50,
      offset: req.query.offset ? parseInt(String(req.query.offset), 10) : 0,
    });

    return res.json({
      ...result,
      rows: result.rows.map((row: Record<string, unknown>) => ({
        ...row,
        amountGhs: koboToGhs(Number(row.amount_kobo)),
        feeGhs: koboToGhs(Number(row.fee_kobo)),
        totalGhs: koboToGhs(Number(row.total_kobo)),
        studentName: `${row.first_name} ${row.last_name}`.trim(),
      })),
    });
  } catch (error) {
    console.error('Online payments list error:', error);
    return res.status(500).json({ error: 'Failed to load online payments' });
  }
});

export default router;
