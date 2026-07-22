import express from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import {
  getPlatformPaystackSettings,
  updatePlatformPaystackSettings,
} from '../services/platformPaystackService.js';
import {
  getTenantPaystackConfig,
  type PaystackMode,
} from '../services/paystackService.js';
import {
  listTenantPaystackSummaries,
  upsertSuperAdminTenantPaystack,
} from '../services/onlinePaymentService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole('super-admin'));

/** GET /api/super-admin/paystack/platform */
router.get('/platform', async (_req: AuthRequest, res) => {
  try {
    const config = await getPlatformPaystackSettings();
    return res.json({ config });
  } catch (error) {
    console.error('Super admin paystack platform GET:', error);
    return res.status(500).json({ error: 'Failed to load platform Paystack settings' });
  }
});

/** PUT /api/super-admin/paystack/platform */
router.put('/platform', async (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    const config = await updatePlatformPaystackSettings(
      {
        useLiveKeys: body.useLiveKeys,
        testPublicKey: body.testPublicKey,
        livePublicKey: body.livePublicKey,
        testSecretKey: body.testSecretKey,
        liveSecretKey: body.liveSecretKey,
      },
      req.user?.id ?? null
    );
    return res.json({ config });
  } catch (error) {
    console.error('Super admin paystack platform PUT:', error);
    return res.status(500).json({ error: 'Failed to save platform Paystack settings' });
  }
});

/** GET /api/super-admin/paystack/tenants */
router.get('/tenants', async (req: AuthRequest, res) => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const rows = await listTenantPaystackSummaries(search);
    return res.json({ rows });
  } catch (error) {
    console.error('Super admin paystack tenants GET:', error);
    return res.status(500).json({ error: 'Failed to load tenant Paystack settings' });
  }
});

/** GET /api/super-admin/paystack/tenants/:tenantId */
router.get('/tenants/:tenantId', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(String(req.params.tenantId), 10);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      return res.status(400).json({ error: 'Invalid tenant' });
    }
    const config = await getTenantPaystackConfig(tenantId);
    return res.json({
      config: config
        ? {
            tenantId: config.tenant_id,
            enabled: config.enabled,
            superAdminEnabled: config.super_admin_enabled,
            effectiveEnabled: config.enabled && config.super_admin_enabled,
            mode: config.mode,
            feeBearer: config.fee_bearer,
            subaccountCode: config.subaccount_code,
            payoutAccount: config.payout_account,
          }
        : {
            tenantId,
            enabled: false,
            superAdminEnabled: false,
            effectiveEnabled: false,
            mode: 'scholarnerve' as PaystackMode,
            feeBearer: 'parent',
            subaccountCode: null,
            payoutAccount: null,
          },
    });
  } catch (error) {
    console.error('Super admin paystack tenant GET:', error);
    return res.status(500).json({ error: 'Failed to load tenant Paystack settings' });
  }
});

/** PATCH /api/super-admin/paystack/tenants/:tenantId */
router.patch('/tenants/:tenantId', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(String(req.params.tenantId), 10);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      return res.status(400).json({ error: 'Invalid tenant' });
    }
    const body = req.body || {};
    const saved = await upsertSuperAdminTenantPaystack({
      tenantId,
      superAdminEnabled: body.superAdminEnabled,
      enabled: body.enabled,
      mode: body.mode,
      feeBearer: body.feeBearer,
      subaccountCode: body.subaccountCode,
      payoutAccount: body.payoutAccount,
    });
    return res.json({
      config: {
        tenantId: saved.tenant_id,
        enabled: saved.enabled,
        superAdminEnabled: saved.super_admin_enabled,
        effectiveEnabled: saved.enabled && saved.super_admin_enabled,
        mode: saved.mode,
        feeBearer: saved.fee_bearer,
        subaccountCode: saved.subaccount_code,
        payoutAccount: saved.payout_account,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save tenant Paystack settings';
    return res.status(400).json({ error: message });
  }
});

export default router;
