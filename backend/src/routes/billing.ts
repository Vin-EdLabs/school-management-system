import express from 'express';
import { authenticate, requireTenant, requireRole, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { query } from '../db/connection.js';
import {
  getCurrentOutstandingInvoice,
  listInvoicesForTenant,
  initializePlatformInvoicePayment,
  verifyPlatformInvoicePayment,
  getBillingConfig,
} from '../services/platformBillingService.js';
import { getInvoiceBranding } from '../services/invoiceBrandingService.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
// Same three-role allowlist used by the school-scoped announcements channel — never teacher/staff.
router.use(requireRole('administrator', 'finance', 'headmaster'));

router.get('/current', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const [invoice, config] = await Promise.all([
      getCurrentOutstandingInvoice(tenantId),
      getBillingConfig(tenantId),
    ]);
    res.json({ invoice, billingFrequency: config?.billingFrequency ?? null });
  } catch (error) {
    console.error('[billing] current error:', error);
    res.status(500).json({ error: 'Failed to load billing status' });
  }
});

router.get('/branding', async (_req: AuthRequest, res) => {
  try {
    const branding = await getInvoiceBranding();
    res.json(branding);
  } catch (error) {
    console.error('[billing] branding error:', error);
    res.status(500).json({ error: 'Failed to load invoice branding' });
  }
});

router.get('/history', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const invoices = await listInvoicesForTenant(tenantId);
    res.json(invoices);
  } catch (error) {
    console.error('[billing] history error:', error);
    res.status(500).json({ error: 'Failed to load billing history' });
  }
});

async function resolvePayerEmail(userId: number, tenantId: number): Promise<string> {
  const res = await query(`SELECT email FROM users WHERE id = $1`, [userId]);
  const email = res.rows[0]?.email ? String(res.rows[0].email).trim() : '';
  return email || `billing+tenant${tenantId}@scholarnerve.com`;
}

router.post('/invoices/:invoiceId/pay/initialize', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const invoiceId = parseInt(req.params.invoiceId, 10);
    if (Number.isNaN(invoiceId)) return res.status(400).json({ error: 'Invalid invoice id' });

    const email = await resolvePayerEmail(req.user!.id, tenantId);
    const callbackUrl = typeof req.body?.callbackUrl === 'string' ? req.body.callbackUrl : undefined;
    const result = await initializePlatformInvoicePayment(tenantId, invoiceId, email, callbackUrl);
    res.json(result);
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status || 400;
    const message = error instanceof Error ? error.message : 'Failed to start payment';
    console.error('[billing] initialize error:', error);
    res.status(status).json({ error: message });
  }
});

router.get('/pay/verify', async (req: AuthRequest, res) => {
  try {
    const reference = String(req.query.reference || '').trim();
    if (!reference) return res.status(400).json({ error: 'reference is required' });

    const invoice = await verifyPlatformInvoicePayment(reference);
    if (invoice.tenantId !== req.user!.tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(invoice);
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status || 400;
    const message = error instanceof Error ? error.message : 'Failed to verify payment';
    console.error('[billing] verify error:', error);
    res.status(status).json({ error: message });
  }
});

export default router;
