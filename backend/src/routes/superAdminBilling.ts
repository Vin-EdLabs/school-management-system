import express from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { getClientIp } from '../utils/clientIp.js';
import { query } from '../db/connection.js';
import {
  getActiveStudentCount,
  getBillingConfig,
  upsertBillingConfig,
  postInvoice,
  listInvoicesForTenant,
  markInvoicePaidManually,
} from '../services/platformBillingService.js';
import { getInvoiceBranding, updateInvoiceBranding } from '../services/invoiceBrandingService.js';

const router = express.Router();

router.use(authenticate, requireRole('super-admin'));

/** Fresh active-student count for a school — shown to super admin before they confirm a bill. */
router.get('/tenants/:tenantId/active-student-count', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (Number.isNaN(tenantId)) return res.status(400).json({ error: 'Invalid tenant id' });
    const activeStudentCount = await getActiveStudentCount(tenantId);
    res.json({ tenantId, activeStudentCount });
  } catch (error) {
    console.error('[superadmin billing] active count error:', error);
    res.status(500).json({ error: 'Failed to load active student count' });
  }
});

router.get('/tenants/:tenantId/config', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (Number.isNaN(tenantId)) return res.status(400).json({ error: 'Invalid tenant id' });
    const config = await getBillingConfig(tenantId);
    res.json(config);
  } catch (error) {
    console.error('[superadmin billing] get config error:', error);
    res.status(500).json({ error: 'Failed to load billing configuration' });
  }
});

const configSchema = z.object({
  billingFrequency: z.enum(['termly', 'yearly', 'monthly']),
  pricePerStudentTermly: z.number().min(0),
  pricePerStudentYearly: z.number().min(0),
  pricePerStudentMonthly: z.number().min(0),
});

router.put('/tenants/:tenantId/config', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (Number.isNaN(tenantId)) return res.status(400).json({ error: 'Invalid tenant id' });
    const body = configSchema.parse(req.body);
    const config = await upsertBillingConfig(tenantId, body, req.user!.id);
    res.json(config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save billing configuration';
    console.error('[superadmin billing] save config error:', error);
    res.status(400).json({ error: message });
  }
});

router.get('/tenants/:tenantId/invoices', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (Number.isNaN(tenantId)) return res.status(400).json({ error: 'Invalid tenant id' });
    const invoices = await listInvoicesForTenant(tenantId);
    res.json(invoices);
  } catch (error) {
    console.error('[superadmin billing] list invoices error:', error);
    res.status(500).json({ error: 'Failed to load invoices' });
  }
});

const postInvoiceSchema = z.object({
  finalAmount: z.number().min(0).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

router.post('/tenants/:tenantId/invoices', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (Number.isNaN(tenantId)) return res.status(400).json({ error: 'Invalid tenant id' });
    const body = postInvoiceSchema.parse(req.body);
    const invoice = await postInvoice(tenantId, body, req.user!.id, getClientIp(req), req.get('user-agent') ?? null);
    res.json(invoice);
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status || 400;
    const message = error instanceof Error ? error.message : 'Failed to post invoice';
    console.error('[superadmin billing] post invoice error:', error);
    res.status(status).json({ error: message });
  }
});

/** Manually reconcile an off-platform payment (bank transfer, cash, momo, etc). */
router.post('/tenants/:tenantId/invoices/:invoiceId/mark-paid', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    const invoiceId = parseInt(req.params.invoiceId, 10);
    if (Number.isNaN(tenantId) || Number.isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid tenant or invoice id' });
    }
    const invoice = await markInvoicePaidManually(
      tenantId,
      invoiceId,
      req.user!.id,
      getClientIp(req),
      req.get('user-agent') ?? null
    );
    res.json(invoice);
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status || 400;
    const message = error instanceof Error ? error.message : 'Failed to mark invoice as paid';
    console.error('[superadmin billing] mark-paid error:', error);
    res.status(status).json({ error: message });
  }
});

/** School name/address/email for the "Bill To" block in the super-admin invoice preview. */
router.get('/tenants/:tenantId/school-info', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (Number.isNaN(tenantId)) return res.status(400).json({ error: 'Invalid tenant id' });

    const result = await query(
      `SELECT COALESCE(ss.school_name, t.name) AS name, ss.address, ss.contact, ss.email
       FROM tenants t
       LEFT JOIN school_settings ss ON ss.tenant_id = t.id
       WHERE t.id = $1`,
      [tenantId]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'School not found' });
    res.json({
      name: row.name,
      address: row.address || null,
      contact: row.contact || null,
      email: row.email || null,
    });
  } catch (error) {
    console.error('[superadmin billing] school-info error:', error);
    res.status(500).json({ error: 'Failed to load school info' });
  }
});

router.get('/branding', async (_req: AuthRequest, res) => {
  try {
    const branding = await getInvoiceBranding();
    res.json(branding);
  } catch (error) {
    console.error('[superadmin billing] get branding error:', error);
    res.status(500).json({ error: 'Failed to load invoice branding' });
  }
});

const brandingSchema = z.object({
  companyName: z.string().min(1),
  tagline: z.string().min(1),
  address: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().min(1),
  bankName: z.string().nullable().optional(),
  bankAccountName: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  momoNumber: z.string().nullable().optional(),
  defaultNotes: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
});

router.put('/branding', async (req: AuthRequest, res) => {
  try {
    const body = brandingSchema.parse(req.body);
    const branding = await updateInvoiceBranding(body, req.user!.id);
    res.json(branding);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save invoice branding';
    console.error('[superadmin billing] save branding error:', error);
    res.status(400).json({ error: message });
  }
});

export default router;
