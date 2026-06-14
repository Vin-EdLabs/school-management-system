import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, requireRole, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import { getIO } from '../socket.js';
import {
  accountHasTransactions,
  getAccountBalances,
  getAccountTransactions,
  getLegacyMigrationStatus,
  migrateLegacyTransactions,
  paymentMethodFromAccountType,
} from '../services/paymentAccountService.js';
import { createFundTransfer, listFundTransfers, reverseFundTransfer } from '../services/fundTransferService.js';
import { getCashPosition } from '../services/financeSummaryService.js';

const router = express.Router();

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

const adminRoles = requireRole('super-admin', 'administrator');
const financeViewRoles = requireRole('super-admin', 'administrator', 'finance');

async function auditAccountAction(
  req: AuthRequest,
  action: string,
  entityId: number,
  summary: string,
  details: Record<string, unknown>,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>
) {
  await writeAuditLog({
    tenantId: req.user!.tenantId!,
    userId: req.user!.id,
    userRole: req.user!.role,
    action,
    entityType: 'PAYMENT_ACCOUNT',
    entityId,
    module: 'finance',
    status: 'success',
    summary,
    details,
    beforeValues: before,
    afterValues: after,
    ipAddress: getClientIp(req),
    userAgent: req.get('user-agent') || null,
  });
}

// GET /api/payment-accounts
router.get('/', financeViewRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await query(
      `SELECT * FROM payment_accounts
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY is_default DESC, account_type, account_name`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get payment accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch payment accounts' });
  }
});

// GET /api/payment-accounts/balances
router.get('/balances', financeViewRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const cashPosition = await getCashPosition(tenantId);
    res.json({
      accounts: cashPosition.accounts,
      totalBalance: cashPosition.totalCashPosition,
      accountsTotal: cashPosition.accountsTotal,
      legacyUnlinkedNet: cashPosition.legacyUnlinkedNet,
    });
  } catch (error) {
    console.error('Get payment account balances error:', error);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

// GET /api/payment-accounts/legacy-status
router.get('/legacy-status', adminRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const status = await getLegacyMigrationStatus(tenantId);
    res.json(status);
  } catch (error) {
    console.error('Legacy status error:', error);
    res.status(500).json({ error: 'Failed to fetch legacy status' });
  }
});

// POST /api/payment-accounts/legacy-migrate
router.post('/legacy-migrate', adminRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { cash_account_id, bank_account_id, momo_account_id } = req.body;
    const result = await migrateLegacyTransactions(tenantId, {
      cash: cash_account_id ? parseInt(String(cash_account_id), 10) : undefined,
      bank: bank_account_id ? parseInt(String(bank_account_id), 10) : undefined,
      momo: momo_account_id ? parseInt(String(momo_account_id), 10) : undefined,
    });

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'LEGACY_MIGRATION',
      entityType: 'PAYMENT_ACCOUNT',
      module: 'finance',
      status: 'success',
      summary: `Mapped ${result.totalMapped} legacy transaction(s) to payment accounts`,
      details: { mappings: req.body, updates: result.updates },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTenantDataChanged(tenantId, 'payment-account', 'updated');
    res.json(result);
  } catch (error: any) {
    console.error('Legacy migrate error:', error);
    res.status(400).json({ error: error?.message || 'Failed to migrate legacy transactions' });
  }
});

// GET /api/payment-accounts/transfers
router.get('/transfers', financeViewRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const rows = await listFundTransfers(tenantId, parseInt(String(req.query.limit || 50), 10));
    res.json(rows);
  } catch (error) {
    console.error('List transfers error:', error);
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

// POST /api/payment-accounts/transfers
router.post('/transfers', adminRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { from_account_id, to_account_id, amount, transfer_date, note } = req.body;
    const transfer = await createFundTransfer(tenantId, req.user!.id, {
      from_account_id: parseInt(String(from_account_id), 10),
      to_account_id: parseInt(String(to_account_id), 10),
      amount: parseFloat(amount),
      transfer_date: transfer_date || new Date().toISOString().slice(0, 10),
      note,
    });

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'FUND_TRANSFER',
      entityType: 'FUND_TRANSFER',
      entityId: transfer.id,
      module: 'finance',
      status: 'success',
      summary: `Transferred GHS ${parseFloat(amount).toFixed(2)} between accounts`,
      details: { from_account_id, to_account_id, amount, transfer_date, note },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTenantDataChanged(tenantId, 'fund-transfer', 'created');
    res.status(201).json(transfer);
  } catch (error: any) {
    console.error('Create transfer error:', error);
    res.status(400).json({ error: error?.message || 'Failed to create transfer' });
  }
});

// POST /api/payment-accounts/transfers/:id/reverse
router.post('/transfers/:id/reverse', adminRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const transferId = parseInt(req.params.id, 10);
    const result = await reverseFundTransfer(tenantId, transferId, req.user!.id);

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'FUND_TRANSFER_REVERSED',
      entityType: 'FUND_TRANSFER',
      entityId: transferId,
      module: 'finance',
      status: 'success',
      summary: `Reversed fund transfer #${transferId}`,
      details: { original_transfer_id: transferId, reversal_id: result.reversal.id },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTenantDataChanged(tenantId, 'fund-transfer', 'updated');
    res.json(result);
  } catch (error: any) {
    console.error('Reverse transfer error:', error);
    res.status(400).json({ error: error?.message || 'Failed to reverse transfer' });
  }
});

// GET /api/payment-accounts/transactions
router.get('/transactions', financeViewRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { accountId, startDate, endDate, limit } = req.query;
    const rows = await getAccountTransactions(tenantId, {
      accountId: accountId ? parseInt(String(accountId), 10) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 10,
    });
    res.json(rows);
  } catch (error) {
    console.error('Get payment account transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/payment-accounts — create account (admin only)
router.post('/', adminRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const {
      account_type,
      account_name,
      nickname,
      account_number,
      branch,
      network,
      phone_number,
      opening_balance,
      opening_balance_as_of,
      is_default,
    } = req.body;

    if (!account_type || !account_name) {
      return res.status(400).json({ error: 'Account type and name are required' });
    }
    if (!['cash', 'bank', 'momo'].includes(account_type)) {
      return res.status(400).json({ error: 'Account type must be cash, bank, or momo' });
    }
    if (account_type === 'bank' && !account_number) {
      return res.status(400).json({ error: 'Bank account number is required' });
    }
    if (account_type === 'momo' && (!network || !phone_number)) {
      return res.status(400).json({ error: 'Mobile money network and phone number are required' });
    }

    const openingBal = parseFloat(opening_balance ?? 0);
    if (isNaN(openingBal) || openingBal < 0) {
      return res.status(400).json({ error: 'Opening balance must be zero or greater' });
    }
    const asOfDate = opening_balance_as_of || new Date().toISOString().slice(0, 10);

    if (account_type === 'cash') {
      const existingCash = await query(
        `SELECT id FROM payment_accounts WHERE tenant_id = $1 AND account_type = 'cash' AND is_active = true LIMIT 1`,
        [tenantId]
      );
      if (existingCash.rows.length > 0) {
        return res.status(409).json({ error: 'A Cash at Hand account already exists. Configure its opening balance instead.' });
      }
    }

    if (is_default) {
      await query(
        `UPDATE payment_accounts SET is_default = false, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1`,
        [tenantId]
      );
    }

    const result = await query(
      `INSERT INTO payment_accounts (
         tenant_id, account_type, account_name, nickname, account_number, branch,
         network, phone_number, opening_balance, opening_balance_as_of,
         opening_balance_configured, is_active, is_default
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, true, $11)
       RETURNING *`,
      [
        tenantId,
        account_type,
        account_name.trim(),
        nickname?.trim() || null,
        account_number?.trim() || null,
        branch?.trim() || null,
        network?.trim() || null,
        phone_number?.trim() || null,
        openingBal,
        asOfDate,
        !!is_default,
      ]
    );

    const row = result.rows[0];
    await auditAccountAction(
      req,
      'ACCOUNT_CREATED',
      row.id,
      `Created ${account_type} account "${account_name}"`,
      { account_name, account_type, opening_balance: openingBal, opening_balance_as_of: asOfDate },
      undefined,
      row
    );
    await auditAccountAction(
      req,
      'OPENING_BALANCE_SET',
      row.id,
      `Opening balance set to GHS ${openingBal.toFixed(2)} as of ${asOfDate}`,
      { opening_balance: openingBal, opening_balance_as_of: asOfDate },
      undefined,
      { opening_balance: openingBal, opening_balance_as_of: asOfDate }
    );

    emitTenantDataChanged(tenantId, 'payment-account', 'created');
    res.status(201).json(row);
  } catch (error) {
    console.error('Create payment account error:', error);
    res.status(500).json({ error: 'Failed to create payment account' });
  }
});

// PUT /api/payment-accounts/:id/opening-balance — set/edit opening balance (before transactions)
router.put('/:id/opening-balance', adminRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const accountId = parseInt(req.params.id, 10);
    const { opening_balance, opening_balance_as_of } = req.body;

    const existing = await query(
      `SELECT * FROM payment_accounts WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [accountId, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Payment account not found' });
    }

    const hasTx = await accountHasTransactions(tenantId, accountId);
    if (hasTx) {
      return res.status(400).json({ error: 'Opening balance is locked because transactions exist on this account' });
    }

    const openingBal = parseFloat(opening_balance ?? 0);
    if (isNaN(openingBal) || openingBal < 0) {
      return res.status(400).json({ error: 'Opening balance must be zero or greater' });
    }
    const asOfDate = opening_balance_as_of || new Date().toISOString().slice(0, 10);

    const result = await query(
      `UPDATE payment_accounts SET
         opening_balance = $1,
         opening_balance_as_of = $2,
         opening_balance_configured = true,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [openingBal, asOfDate, accountId, tenantId]
    );

    await auditAccountAction(
      req,
      'OPENING_BALANCE_SET',
      accountId,
      `Opening balance set to GHS ${openingBal.toFixed(2)} as of ${asOfDate}`,
      { opening_balance: openingBal, opening_balance_as_of: asOfDate },
      {
        opening_balance: existing.rows[0].opening_balance,
        opening_balance_as_of: existing.rows[0].opening_balance_as_of,
      },
      { opening_balance: openingBal, opening_balance_as_of: asOfDate }
    );

    emitTenantDataChanged(tenantId, 'payment-account', 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Set opening balance error:', error);
    res.status(500).json({ error: 'Failed to set opening balance' });
  }
});

// PUT /api/payment-accounts/:id — update account details (not opening balance)
router.put('/:id', adminRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const accountId = parseInt(req.params.id, 10);
    const { account_name, nickname, account_number, branch, network, phone_number, is_default } = req.body;

    const existing = await query(
      `SELECT * FROM payment_accounts WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [accountId, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Payment account not found' });
    }

    if (is_default) {
      await query(
        `UPDATE payment_accounts SET is_default = false, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1`,
        [tenantId]
      );
    }

    const result = await query(
      `UPDATE payment_accounts SET
         account_name = COALESCE($1, account_name),
         nickname = COALESCE($2, nickname),
         account_number = COALESCE($3, account_number),
         branch = COALESCE($4, branch),
         network = COALESCE($5, network),
         phone_number = COALESCE($6, phone_number),
         is_default = COALESCE($7, is_default),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND tenant_id = $9 RETURNING *`,
      [
        account_name?.trim() || null,
        nickname?.trim() || null,
        account_number?.trim() || null,
        branch?.trim() || null,
        network?.trim() || null,
        phone_number?.trim() || null,
        typeof is_default === 'boolean' ? is_default : null,
        accountId,
        tenantId,
      ]
    );

    await auditAccountAction(
      req,
      'ACCOUNT_UPDATED',
      accountId,
      `Updated account "${result.rows[0].account_name}"`,
      { account_name: result.rows[0].account_name },
      existing.rows[0],
      result.rows[0]
    );

    emitTenantDataChanged(tenantId, 'payment-account', 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update payment account error:', error);
    res.status(500).json({ error: 'Failed to update payment account' });
  }
});

// DELETE /api/payment-accounts/:id
router.delete('/:id', adminRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const accountId = parseInt(req.params.id, 10);

    const existing = await query(
      `SELECT * FROM payment_accounts WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [accountId, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Payment account not found' });
    }

    if (existing.rows[0].account_type === 'cash') {
      return res.status(400).json({ error: 'The Cash at Hand account cannot be deleted' });
    }

    await query(
      `UPDATE payment_accounts SET is_active = false, is_default = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,
      [accountId, tenantId]
    );

    await auditAccountAction(
      req,
      'ACCOUNT_DELETED',
      accountId,
      `Deactivated account "${existing.rows[0].account_name}"`,
      { account_name: existing.rows[0].account_name },
      existing.rows[0],
      undefined
    );

    emitTenantDataChanged(tenantId, 'payment-account', 'deleted');
    res.json({ message: 'Payment account deactivated' });
  } catch (error) {
    console.error('Delete payment account error:', error);
    res.status(500).json({ error: 'Failed to delete payment account' });
  }
});

export default router;
