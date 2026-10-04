import express from 'express';
import { authenticate, requireTenant, requireRole, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { query } from '../db/connection.js';
import {
  getTenantSmsWallet,
  creditTenantSmsBalance,
  checkMasterArkeselBalance,
  sendArkeselSms,
  SMS_PACKAGES,
  getActiveSmsPackages,
  getAllSmsPackages,
  saveSmsPackages,
  deleteSmsPackage,
  normalizePhoneNumber,
} from '../services/arkeselService.js';
import { resolvePlatformPaystackKeys } from '../services/platformPaystackService.js';
import { paystackInitializeTransaction, paystackVerifyTransaction } from '../services/paystackService.js';

const router = express.Router();

function isSuperAdminUser(req: AuthRequest): boolean {
  const role = String(req.user?.role || '').toLowerCase();
  return role === 'super-admin' || role === 'superadmin';
}

function resolveTargetTenantId(req: AuthRequest): number | null {
  if (req.user?.tenantId != null && Number(req.user.tenantId) > 0) {
    return Number(req.user.tenantId);
  }
  if (isSuperAdminUser(req) && req.query.tenantId) {
    const fromQuery = parseInt(String(req.query.tenantId), 10);
    if (!isNaN(fromQuery) && fromQuery > 0) return fromQuery;
  }
  return null;
}

// All standard SMS routes require authentication
router.use(authenticate);

// -------------------------------------------------------------
// SUPER-ADMIN MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

// Get all packages (for superadmin bundle & pricing management)
router.get('/admin/packages', async (req: AuthRequest, res) => {
  if (!isSuperAdminUser(req)) {
    return res.status(403).json({ error: 'Super-admin access required' });
  }

  try {
    const packages = await getAllSmsPackages();
    res.json({ packages });
  } catch (error: any) {
    console.error('[sms-admin] get packages error:', error);
    res.status(500).json({ error: error?.message || 'Failed to fetch SMS packages' });
  }
});

// Update or add packages (superadmin)
router.put('/admin/packages', async (req: AuthRequest, res) => {
  if (!isSuperAdminUser(req)) {
    return res.status(403).json({ error: 'Super-admin access required' });
  }

  try {
    const packages = req.body?.packages;
    if (!Array.isArray(packages)) {
      return res.status(400).json({ error: 'Expected an array of packages' });
    }
    const updated = await saveSmsPackages(packages);
    res.json({ success: true, packages: updated });
  } catch (error: any) {
    console.error('[sms-admin] save packages error:', error);
    res.status(500).json({ error: error?.message || 'Failed to save SMS packages' });
  }
});

// Delete package tier (superadmin)
router.delete('/admin/packages/:id', async (req: AuthRequest, res) => {
  if (!isSuperAdminUser(req)) {
    return res.status(403).json({ error: 'Super-admin access required' });
  }

  try {
    const packageId = String(req.params.id);
    await deleteSmsPackage(packageId);
    res.json({ success: true, message: 'Package deleted successfully' });
  } catch (error: any) {
    console.error('[sms-admin] delete package error:', error);
    res.status(500).json({ error: error?.message || 'Failed to delete SMS package' });
  }
});

router.get('/admin/master-balance', async (req: AuthRequest, res) => {
  if (!isSuperAdminUser(req)) {
    return res.status(403).json({ error: 'Super-admin access required' });
  }

  try {
    const balanceInfo = await checkMasterArkeselBalance();
    res.json(balanceInfo);
  } catch (error: any) {
    console.error('[sms-admin] master balance error:', error);
    res.status(500).json({ error: error?.message || 'Failed to fetch Arkesel master balance' });
  }
});

router.post('/admin/credit', async (req: AuthRequest, res) => {
  if (!isSuperAdminUser(req)) {
    return res.status(403).json({ error: 'Super-admin access required' });
  }

  try {
    const tenantId = parseInt(String(req.body?.tenantId), 10);
    const credits = parseInt(String(req.body?.credits), 10);
    const reason = String(req.body?.reason || 'superadmin_grant').trim();

    if (!Number.isFinite(tenantId) || tenantId <= 0) {
      return res.status(400).json({ error: 'Valid tenantId is required' });
    }
    if (!Number.isFinite(credits) || credits <= 0) {
      return res.status(400).json({ error: 'Credits must be a positive integer' });
    }

    const result = await creditTenantSmsBalance(tenantId, credits, reason, req.user!.id);

    // Record topup transaction for auditing
    await query(
      `INSERT INTO sms_topup_transactions
         (tenant_id, package_name, amount_ghs, credits_purchased, paystack_reference, status, payment_method, initiated_by, paid_at)
       VALUES ($1, $2, 0, $3, $4, 'successful', 'manual_grant', $5, NOW())`,
      [tenantId, `Admin Credit: ${reason}`, credits, `MANUAL-CREDIT-${Date.now()}`, req.user!.id]
    ).catch(() => {});

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[sms-admin] credit error:', error);
    res.status(500).json({ error: error?.message || 'Failed to credit SMS balance' });
  }
});

router.get('/admin/sender-id-requests', async (req: AuthRequest, res) => {
  if (!isSuperAdminUser(req)) {
    return res.status(403).json({ error: 'Super-admin access required' });
  }

  try {
    const list = await query(
      `SELECT r.*, t.name AS school_name, COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS requester_name
       FROM sms_sender_id_requests r
       JOIN tenants t ON t.id = r.tenant_id
       LEFT JOIN users u ON u.id = r.requested_by
       ORDER BY r.created_at DESC`
    );
    res.json(list.rows);
  } catch (error: any) {
    console.error('[sms-admin] list sender-id requests error:', error);
    res.status(500).json({ error: 'Failed to load sender ID requests' });
  }
});

router.put('/admin/sender-id-requests/:id', async (req: AuthRequest, res) => {
  if (!isSuperAdminUser(req)) {
    return res.status(403).json({ error: 'Super-admin access required' });
  }

  const requestId = parseInt(req.params.id, 10);
  const { status, rejectionReason } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  }

  try {
    const reqRow = await query(`SELECT * FROM sms_sender_id_requests WHERE id = $1`, [requestId]);
    const r = reqRow.rows[0];
    if (!r) return res.status(404).json({ error: 'Sender ID request not found' });

    await query(
      `UPDATE sms_sender_id_requests
       SET status = $1, rejection_reason = $2, reviewed_by = $3, updated_at = NOW()
       WHERE id = $4`,
      [status, rejectionReason || null, req.user!.id, requestId]
    );

    if (status === 'approved') {
      await query(
        `UPDATE school_settings
         SET sms_sender_id = $1, sms_sender_id_status = 'approved'
         WHERE tenant_id = $2`,
        [r.requested_sender_id, r.tenant_id]
      );
      await query(
        `UPDATE tenants
         SET sms_sender_id = $1
         WHERE id = $2`,
        [r.requested_sender_id, r.tenant_id]
      ).catch(() => {});
    } else {
      await query(
        `UPDATE school_settings
         SET sms_sender_id_status = 'rejected'
         WHERE tenant_id = $1`,
        [r.tenant_id]
      );
    }

    res.json({ success: true, message: `Sender ID request ${status}` });
  } catch (error: any) {
    console.error('[sms-admin] update sender-id request error:', error);
    res.status(500).json({ error: 'Failed to update sender ID request' });
  }
});

// -------------------------------------------------------------
// TENANT-SCOPED SMS ROUTES
// -------------------------------------------------------------

router.use(requireTenant);
router.use(setTenantContext);

// Get SMS wallet, current balance, sender ID, bundle packages & recent logs
router.get('/wallet', async (req: AuthRequest, res) => {
  try {
    const tenantId = resolveTargetTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    const wallet = await getTenantSmsWallet(tenantId);

    const [recentLogs, recentTopups, pendingRequest] = await Promise.all([
      query(
        `SELECT id, recipient_phone, recipient_name, recipient_type, event_type,
                message, segment_count, credits_deducted, status, error_message, created_at
         FROM sms_logs
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 15`,
        [tenantId]
      ).catch(() => ({ rows: [] })),

      query(
        `SELECT id, package_name, amount_ghs, credits_purchased, paystack_reference,
                status, payment_method, paid_at, created_at
         FROM sms_topup_transactions
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [tenantId]
      ).catch(() => ({ rows: [] })),

      query(
        `SELECT requested_sender_id, status, rejection_reason, created_at
         FROM sms_sender_id_requests
         WHERE tenant_id = $1 AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1`,
        [tenantId]
      ).catch(() => ({ rows: [] })),
    ]);

    const activePackages = await getActiveSmsPackages();

    res.json({
      wallet,
      packages: activePackages,
      recentLogs: recentLogs.rows,
      recentTopups: recentTopups.rows,
      pendingSenderIdRequest: pendingRequest.rows[0] || null,
    });
  } catch (error: any) {
    console.error('[sms] get wallet error:', error);
    res.status(500).json({ error: 'Failed to load SMS wallet' });
  }
});

// Update SMS Preferences (toggles & global enabled)
router.put(
  '/preferences',
  requireRole('super-admin', 'administrator', 'finance', 'headmaster'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId =
        req.user?.tenantId ??
        (isSuperAdminUser(req) && req.query.tenantId ? parseInt(String(req.query.tenantId), 10) : null);

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context required' });
      }

      const { enabled, toggles } = req.body;

      // Ensure school_settings row exists for tenant
      await query(
        `INSERT INTO school_settings (tenant_id, school_name)
         VALUES ($1, 'School')
         ON CONFLICT (tenant_id) DO NOTHING`,
        [tenantId]
      );

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (typeof enabled === 'boolean') {
      updates.push(`sms_enabled = $${idx++}`);
      values.push(enabled);
    }

    if (toggles && typeof toggles === 'object') {
      updates.push(`sms_notification_toggles = $${idx++}::jsonb`);
      values.push(JSON.stringify(toggles));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid preferences to update' });
    }

    values.push(tenantId);
    await query(
      `UPDATE school_settings
       SET ${updates.join(', ')}
       WHERE tenant_id = $${idx}`,
      values
    );

    const updatedWallet = await getTenantSmsWallet(tenantId);
    res.json({ success: true, wallet: updatedWallet });
  } catch (error: any) {
    console.error('[sms] update preferences error:', error);
    res.status(500).json({ error: 'Failed to update SMS preferences' });
  }
});

// Request Custom Sender ID
router.post(
  '/sender-id/request',
  requireRole('super-admin', 'administrator', 'headmaster'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = resolveTargetTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context required' });
      }
      const requested = String(req.body?.senderId || '').trim().toUpperCase();
    const purpose = String(req.body?.purpose || '').trim();

    if (!requested || requested.length < 3 || requested.length > 11) {
      return res.status(400).json({ error: 'Sender ID must be between 3 and 11 alphanumeric characters' });
    }

    if (!/^[A-Z0-9]+$/.test(requested)) {
      return res.status(400).json({ error: 'Sender ID must contain only letters and numbers (no spaces or symbols)' });
    }

    // Check if there is already a pending request
    const existing = await query(
      `SELECT id FROM sms_sender_id_requests WHERE tenant_id = $1 AND status = 'pending'`,
      [tenantId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'You already have a pending Sender ID request under review. Please wait for telco approval.',
      });
    }

    await query(
      `INSERT INTO sms_sender_id_requests (tenant_id, requested_sender_id, purpose, status, requested_by)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [tenantId, requested, purpose || null, req.user!.id]
    );

    await query(
      `UPDATE school_settings
       SET sms_sender_id_status = 'pending'
       WHERE tenant_id = $1`,
      [tenantId]
    );

    res.json({
      success: true,
      message: `Your request for Sender ID '${requested}' has been submitted for telco approval (typically 24–48 hours).`,
      requestedSenderId: requested,
    });
  } catch (error: any) {
    console.error('[sms] request sender-id error:', error);
    res.status(500).json({ error: 'Failed to submit Sender ID request' });
  }
});

// Initialize Top-Up Payment via Paystack
router.post(
  '/topup/initialize',
  requireRole('super-admin', 'administrator', 'finance', 'headmaster'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = resolveTargetTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context required' });
      }
      const { packageId, callbackUrl } = req.body;

    const activePackages = await getActiveSmsPackages();
    const selectedPkg = activePackages.find((p) => p.id === packageId);
    if (!selectedPkg) {
      return res.status(400).json({ error: 'Invalid SMS package selected' });
    }

    const platform = await resolvePlatformPaystackKeys();
    if (!platform.secretKey) {
      return res.status(503).json({
        error: 'ScholarNerve Paystack payments are not configured. Please contact support.',
      });
    }

    // Fetch school contact email
    const userRes = await query(`SELECT email FROM users WHERE id = $1`, [req.user!.id]);
    const payerEmail = userRes.rows[0]?.email || `billing+tenant${tenantId}@scholarnerve.com`;

    const reference = `SMS-TOPUP-${tenantId}-${Date.now()}`;
    const amountKobo = Math.round(selectedPkg.priceGhs * 100);

    // Create pending topup record
    await query(
      `INSERT INTO sms_topup_transactions
         (tenant_id, package_name, amount_ghs, credits_purchased, paystack_reference, status, payment_method, initiated_by)
       VALUES ($1, $2, $3, $4, $5, 'pending', 'paystack', $6)`,
      [tenantId, selectedPkg.name, selectedPkg.priceGhs, selectedPkg.credits, reference, req.user!.id]
    );

    const init = await paystackInitializeTransaction(platform.secretKey, {
      email: payerEmail,
      amountKobo,
      reference,
      callbackUrl: callbackUrl || undefined,
      metadata: {
        tenantId,
        packageId: selectedPkg.id,
        credits: selectedPkg.credits,
        kind: 'sms_topup',
      },
      feeBearer: 'school',
    });

    res.json({
      authorizationUrl: init.authorization_url,
      reference: init.reference,
      accessCode: init.access_code,
      packageName: selectedPkg.name,
      credits: selectedPkg.credits,
      priceGhs: selectedPkg.priceGhs,
    });
  } catch (error: any) {
    console.error('[sms] topup initialize error:', error);
    res.status(500).json({ error: error?.message || 'Failed to initialize top-up payment' });
  }
});

// Verify Top-Up Payment Reference
router.get(
  '/topup/verify',
  requireRole('super-admin', 'administrator', 'finance', 'headmaster'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = resolveTargetTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context required' });
      }
      const reference = String(req.query.reference || '').trim();

    if (!reference) {
      return res.status(400).json({ error: 'reference query param is required' });
    }

    const txRes = await query(
      `SELECT * FROM sms_topup_transactions WHERE paystack_reference = $1 AND tenant_id = $2`,
      [reference, tenantId]
    );
    const tx = txRes.rows[0];
    if (!tx) {
      return res.status(404).json({ error: 'Top-up transaction not found' });
    }

    // If already successful, return idempotent current wallet state
    if (tx.status === 'successful') {
      const wallet = await getTenantSmsWallet(tenantId);
      return res.json({ success: true, message: 'Transaction already verified', wallet });
    }

    const platform = await resolvePlatformPaystackKeys();
    if (!platform.secretKey) {
      return res.status(503).json({ error: 'Paystack is not configured' });
    }

    const verification = await paystackVerifyTransaction(platform.secretKey, reference);

    if (verification.status === 'success') {
      // Mark transaction successful
      await query(
        `UPDATE sms_topup_transactions
         SET status = 'successful', paid_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [tx.id]
      );

      // Credit wallet
      const creditResult = await creditTenantSmsBalance(
        tenantId,
        Number(tx.credits_purchased),
        `Paystack topup: ${tx.package_name}`,
        req.user!.id
      );

      res.json({
        success: true,
        message: `Successfully credited ${tx.credits_purchased} SMS credits!`,
        previousBalance: creditResult.previousBalance,
        newBalance: creditResult.newBalance,
        creditsAdded: tx.credits_purchased,
      });
    } else {
      await query(
        `UPDATE sms_topup_transactions SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [tx.id]
      );
      res.status(400).json({ error: `Payment was not completed. Status: ${verification.status}` });
    }
  } catch (error: any) {
    console.error('[sms] topup verify error:', error);
    res.status(500).json({ error: error?.message || 'Failed to verify payment' });
  }
});

// Send a test SMS to an admin-specified phone
router.post(
  '/test',
  requireRole('super-admin', 'administrator', 'headmaster'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = resolveTargetTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context required' });
      }
      const phone = String(req.body?.phone || '').trim();
    const customMessage = String(req.body?.message || '').trim();

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const testMessage =
      customMessage ||
      `This is a test notification from your school on ScholarNerve. Your SMS gateway is active and configured!`;

    const result = await sendArkeselSms({
      tenantId,
      recipients: [{ phone, name: 'Admin Test', recipientType: 'staff' }],
      message: testMessage,
      eventType: 'test',
      skipToggleCheck: true,
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error || 'Failed to send test SMS',
        remainingBalance: result.remainingBalance,
      });
    }

    res.json({
      success: true,
      message: `Test SMS sent successfully to ${phone}`,
      creditsDeducted: result.creditsDeducted,
      remainingBalance: result.remainingBalance,
    });
  } catch (error: any) {
    console.error('[sms] test error:', error);
    res.status(500).json({ error: error?.message || 'Failed to send test SMS' });
  }
});

// Paginated SMS Logs
router.get('/logs', async (req: AuthRequest, res) => {
  try {
    const tenantId = resolveTargetTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10)));
    const offset = (page - 1) * limit;

    const eventFilter = req.query.eventType ? String(req.query.eventType).trim() : null;
    const statusFilter = req.query.status ? String(req.query.status).trim() : null;
    const search = req.query.search ? String(req.query.search).trim() : null;

    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let idx = 2;

    if (eventFilter && eventFilter !== 'all') {
      whereClause += ` AND event_type = $${idx++}`;
      params.push(eventFilter);
    }

    if (statusFilter && statusFilter !== 'all') {
      whereClause += ` AND status = $${idx++}`;
      params.push(statusFilter);
    }

    if (search) {
      whereClause += ` AND (recipient_phone ILIKE $${idx} OR recipient_name ILIKE $${idx} OR message ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const countRes = await query(`SELECT COUNT(*)::int AS total FROM sms_logs WHERE ${whereClause}`, params);
    const total = Number(countRes.rows[0]?.total || 0);

    const rowsRes = await query(
      `SELECT id, recipient_phone, recipient_name, recipient_type, event_type,
              message, segment_count, credits_deducted, status, error_message, created_at
       FROM sms_logs
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    res.json({
      logs: rowsRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('[sms] get logs error:', error);
    res.status(500).json({ error: 'Failed to load SMS logs' });
  }
});

export default router;
