import express from 'express';
import multer from 'multer';
import { getClient, query } from '../db/connection.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import {
  exportFullTenantBackup,
  validateTenantBackup,
  restoreTenantData,
  clearTenantData,
  writeSafetyBackup,
} from '../services/tenantBackupService.js';
import { importDemoDataForTenant, getPrimaryAdminProfile } from '../demo/demoImportService.js';
import { getIO } from '../socket.js';

const router = express.Router();
const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

router.use(authenticate);
router.use(requireRole('super-admin'));

async function logBackupAction(
  req: AuthRequest,
  opts: {
    action: string;
    tenantId: number;
    schoolName: string;
    summary: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  await writeAuditLog({
    tenantId: null,
    userId: req.user!.id,
    userRole: req.user!.role,
    action: opts.action,
    entityType: 'TENANT_DATA',
    entityId: opts.tenantId,
    module: 'superadmin',
    status: 'success',
    summary: opts.summary,
    details: {
      targetTenantId: opts.tenantId,
      schoolName: opts.schoolName,
      performedBy: req.user!.username,
      ...opts.details,
    },
    ipAddress: getClientIp(req),
    userAgent: req.get('user-agent') || null,
  });
}

const emitTenantChanged = (tenantId: number, action: 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to('global:general').emit('tenant-data-changed', { tenantId, entity: 'tenant-data', action, at: Date.now() });
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity: 'tenant-data', action, at: Date.now() });
  } catch {
    /* noop */
  }
};

function parseBackupPayload(req: AuthRequest): unknown {
  if (req.file?.buffer) {
    return JSON.parse(req.file.buffer.toString('utf8'));
  }
  if (typeof req.body?.backup === 'string') {
    return JSON.parse(req.body.backup);
  }
  return req.body?.backup ?? null;
}

function backupFilename(slug: string): string {
  const safe = (slug || 'school').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `scholarnerve_backup_${safe || 'school'}_${Date.now()}.json`;
}

// GET /api/super-admin/tenants/:tenantId/backup
router.get('/:tenantId/backup', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid tenant id' });

    const backup = await exportFullTenantBackup(tenantId, req.user!.username || 'super-admin');
    const filename = backupFilename(backup.manifest.tenant_slug);

    await logBackupAction(req, {
      action: 'BACKUP_EXPORT',
      tenantId,
      schoolName: backup.manifest.tenant_name,
      summary: `Full backup exported for ${backup.manifest.tenant_name} by ${req.user!.username} — ${backup.manifest.total_records} total records across ${Object.keys(backup.manifest.table_counts).length} tables`,
      details: {
        table_counts: backup.manifest.table_counts,
        total_records: backup.manifest.total_records,
        checksum: backup.manifest.checksum,
      },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backup);
  } catch (error) {
    console.error('Tenant backup error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to create backup' });
  }
});

// POST /api/super-admin/tenants/:tenantId/validate-backup
router.post('/:tenantId/validate-backup', backupUpload.single('backup'), async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid tenant id' });
    const payload = parseBackupPayload(req);
    if (!payload) return res.status(400).json({ error: 'Upload a JSON backup file.' });
    res.json(validateTenantBackup(tenantId, payload));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message || 'Invalid backup file' });
  }
});

// POST /api/super-admin/tenants/:tenantId/restore
router.post('/:tenantId/restore', backupUpload.single('backup'), async (req: AuthRequest, res) => {
  const tenantId = parseInt(req.params.tenantId, 10);
  if (!tenantId) return res.status(400).json({ error: 'Invalid tenant id' });

  if (req.body?.type === 'demo') {
    try {
      const tenant = await query('SELECT id, name, slug FROM tenants WHERE id = $1', [tenantId]);
      if (tenant.rows.length === 0) return res.status(404).json({ error: 'School not found' });
      const schoolName = String(tenant.rows[0].name);

      const summary = await importDemoDataForTenant(tenantId);

      await logBackupAction(req, {
        action: 'DEMO_IMPORT',
        tenantId,
        schoolName,
        summary: `Demo data loaded for ${schoolName} by ${req.user!.username}`,
        details: { ...summary },
      });

      emitTenantChanged(tenantId, 'updated');
      return res.json({
        success: true,
        type: 'demo',
        message: `Demo data loaded for ${schoolName}`,
        summary,
      });
    } catch (error) {
      console.error('Demo import error:', error);
      return res.status(500).json({ error: (error as Error).message || 'Failed to load demo data' });
    }
  }

  const client = await getClient();
  try {
    const payload = parseBackupPayload(req);
    if (!payload) return res.status(400).json({ error: 'Upload a JSON backup file.' });

    const validation = validateTenantBackup(tenantId, payload);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors.join(' ') });
    }

    const tenant = await query('SELECT id, name, slug FROM tenants WHERE id = $1', [tenantId]);
    if (tenant.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    const schoolName = String(tenant.rows[0].name);

    const safetyPath = await writeSafetyBackup(tenantId, 'pre-restore');

    await client.query('BEGIN');
    const { restored } = await restoreTenantData(client, tenantId, payload);
    await client.query('COMMIT');

    const total = Object.values(restored).reduce((a, b) => a + b, 0);
    const backupDate = validation.manifest?.created_at || 'unknown date';

    await logBackupAction(req, {
      action: 'BACKUP_IMPORT',
      tenantId,
      schoolName,
      summary: `Full restore completed for ${schoolName} from backup created ${backupDate} by ${req.user!.username}`,
      details: { restored, safety_backup_path: safetyPath, backup_created_at: backupDate },
    });

    emitTenantChanged(tenantId, 'updated');
    res.json({
      success: true,
      message: `Restore complete for ${schoolName}`,
      restored: validation.manifest?.table_counts || restored,
      total_records: validation.total_records ?? total,
      restored_at: new Date().toISOString(),
      safety_backup_path: safetyPath,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Tenant restore error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to restore tenant data' });
  } finally {
    client.release();
  }
});

// POST /api/super-admin/tenants/:tenantId/reset
router.post('/:tenantId/reset', async (req: AuthRequest, res) => {
  const client = await getClient();
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    const { confirmation } = req.body || {};
    if (!tenantId) return res.status(400).json({ error: 'Invalid tenant id' });

    const expected = `RESET_TENANT_${tenantId}`;
    if (confirmation !== expected) {
      return res.status(400).json({
        error: `Invalid confirmation code. Pass confirmation: "${expected}"`,
      });
    }

    const tenant = await client.query('SELECT id, name FROM tenants WHERE id = $1', [tenantId]);
    if (tenant.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    const schoolName = String(tenant.rows[0].name);

    const primaryAdmin = await getPrimaryAdminProfile(client, tenantId);
    const safetyPath = await writeSafetyBackup(tenantId, 'pre-reset');

    await client.query('BEGIN');
    const clearResult = await clearTenantData(client, tenantId, {
      keepTenant: true,
      preserveAccounts: false,
      preserveUserId: primaryAdmin?.id,
    });
    await client.query('COMMIT');

    const preservedAfter = primaryAdmin
      ? await getPrimaryAdminProfile(client, tenantId)
      : null;

    await logBackupAction(req, {
      action: 'FULL_RESET',
      tenantId,
      schoolName,
      summary: `FULL RESET performed on ${schoolName} by ${req.user!.username} — operational data deleted; primary admin preserved`,
      details: {
        safety_backup_path: safetyPath,
        timestamp: new Date().toISOString(),
        deleted_tables: clearResult.deletedTables,
        preserved_admin_id: preservedAfter?.id ?? null,
      },
    });

    emitTenantChanged(tenantId, 'deleted');
    res.json({
      success: true,
      message: `${schoolName} data reset successfully`,
      safety_backup_path: safetyPath,
      deleted_tables: clearResult.deletedTables,
      preservedAdmin: preservedAfter
        ? { name: preservedAfter.name, email: preservedAfter.email }
        : null,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Tenant reset error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to reset tenant data' });
  } finally {
    client.release();
  }
});

export default router;
