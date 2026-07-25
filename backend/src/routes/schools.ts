import express from 'express';
import bcrypt from 'bcryptjs';
import { TEACHER_COUNTABLE_WHERE, OTHER_STAFF_COUNTABLE_WHERE } from '../constants/staffQueries.js';
import { permanentlyRemoveTeacher, restoreTeacher } from '../services/teacherRemovalService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getClient, query } from '../db/connection.js';
import { authenticate, requireRole, AuthRequest, requirePrimaryAdminOrSuperAdmin } from '../middleware/auth.js';
import { getIO } from '../socket.js';
import { ensureSetupProgressRow, getSetupProgress } from '../services/setupProgressService.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import {
  exportSchoolBackup,
  importSchoolBackup,
  validateSchoolBackup,
  clearTenantData,
  writeSafetyBackup,
} from '../services/schoolDataService.js';
import { importDemoDataForTenant, getPrimaryAdminProfile } from '../demo/demoImportService.js';
import { syncSchoolSettingsFromTenant } from '../services/schoolBrandingService.js';
import {
  getIdCardTemplate,
  updateIdCardTemplate,
  getSchoolCardContext,
  mapTemplateToApi,
  type CardTypeKey,
} from '../services/idCardService.js';
import {
  formatTenantSlugConflictError,
  resolveTenantSlugForCreate,
  resolveTenantSlugForUpdate,
} from '../services/tenantSlugService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

const router = express.Router();

const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

async function logSchoolDataAction(
  req: AuthRequest,
  opts: {
    action: string;
    targetTenantId: number;
    schoolName: string;
    summary: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  const isSuperAdmin = req.user?.role === 'super-admin';
  await writeAuditLog({
    tenantId: isSuperAdmin ? null : opts.targetTenantId,
    userId: req.user!.id,
    userRole: req.user!.role,
    action: opts.action,
    entityType: 'TENANT_DATA',
    entityId: opts.targetTenantId,
    module: isSuperAdmin ? 'superadmin' : 'settings',
    status: 'success',
    summary: opts.summary,
    details: {
      targetTenantId: opts.targetTenantId,
      schoolName: opts.schoolName,
      performedBy: req.user!.username,
      ...opts.details,
    },
    ipAddress: getClientIp(req),
    userAgent: req.get('user-agent') || null,
  });
}

const emitSystemDataChanged = (entity: string, action: 'created' | 'updated' | 'deleted', tenantId?: number) => {
  try {
    const io = getIO();
    io.to('global:general').emit('tenant-data-changed', { tenantId: tenantId ?? null, entity, action, at: Date.now() });
    if (tenantId) {
      io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
    }
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

// Configure multer for memory storage (Base64)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit for Base64

// All routes require authentication
router.use(authenticate);

// Get all schools (super-admin only)
router.get('/', requireRole('super-admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT t.id, t.name, t.slug, t.subdomain, t.logo_url, t.primary_color, t.secondary_color,
              t.subscription_status, t.is_active, t.archived_at, t.created_at, t.updated_at,
              ss.school_name AS settings_school_name
       FROM tenants t
       LEFT JOIN school_settings ss ON ss.tenant_id = t.id
       ORDER BY t.archived_at NULLS FIRST, t.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get schools error:', error);
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

// Super admins management - must be before /:id
router.get('/super-admins', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, username, email, full_name, phone, role, is_active, created_at
       FROM users WHERE tenant_id IS NULL AND role = 'super-admin' ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get super admins error:', error);
    res.status(500).json({ error: 'Failed to fetch super admins' });
  }
});

router.post('/super-admins', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { username, password, email, fullName, phone } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existing = await query('SELECT id FROM users WHERE tenant_id IS NULL AND username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (tenant_id, username, email, full_name, phone, password_hash, role)
       VALUES (NULL, $1, $2, $3, $4, $5, 'super-admin') RETURNING id, username, email, full_name, phone, created_at`,
      [username, email || null, fullName || null, phone || null, hashedPassword]
    );
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES (NULL, $1, $2, $3, $4, $5)',
      [req.user!.id, 'CREATE', 'SUPER_ADMIN', result.rows[0].id, JSON.stringify({ username, created_by: req.user!.username })]
    );
    emitSystemDataChanged('super-admin', 'created');
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Create super admin error:', error);
    res.status(500).json({ error: error.message || 'Failed to create super admin' });
  }
});

router.post('/super-admins/:userId/reset-password', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const userCheck = await query('SELECT id, username FROM users WHERE id = $1 AND tenant_id IS NULL AND role = $2', [userId, 'super-admin']);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Super admin not found' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashedPassword, userId]);
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES (NULL, $1, $2, $3, $4, $5)',
      [req.user!.id, 'RESET_PASSWORD', 'SUPER_ADMIN', parseInt(userId), JSON.stringify({ target: userCheck.rows[0].username })]
    );
    emitSystemDataChanged('super-admin', 'updated');
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset super admin password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Create a tenant-scoped backup. Super admins can back up any school; school admins can back up only their school.
// Setup checklist progress (school admin) — must be before /:id
router.get('/:id/setup-progress', requireRole('administrator'), async (req: AuthRequest, res) => {
  try {
    const schoolId = parseInt(req.params.id, 10);
    if (!schoolId || Number.isNaN(schoolId)) {
      return res.status(400).json({ error: 'Invalid school id' });
    }
    if (req.user!.tenantId !== schoolId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const progress = await getSetupProgress(schoolId);
    return res.json(progress);
  } catch (error) {
    console.error('Get setup progress error:', error);
    return res.status(500).json({ error: 'Failed to fetch setup progress' });
  }
});

router.get('/:id/backup', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.id, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid school id' });
    const isSuperAdmin = req.user?.role === 'super-admin';
    const isSchoolAdmin =
      req.user?.role === 'administrator' && req.user?.tenantId === tenantId;
    if (!isSuperAdmin && !isSchoolAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const backup = await exportSchoolBackup(tenantId, req.user!.username || 'user');
    const schoolName = String(backup.manifest?.tenant_name || (backup.school as { name?: string })?.name || 'School');
    const slug = backup.manifest?.tenant_slug || String((backup.school as { slug?: string })?.slug || 'school');
    const filename = `scholarnerve_backup_${slug}_${Date.now()}.json`;

    await logSchoolDataAction(req, {
      action: 'BACKUP_EXPORT',
      targetTenantId: tenantId,
      schoolName,
      summary: isSuperAdmin
        ? `Full backup exported for ${schoolName} by ${req.user!.username} — ${backup.manifest?.total_records ?? 0} records`
        : `School backup exported for ${schoolName}`,
      details: {
        timestamp: backup.manifest?.created_at || backup.generatedAt,
        table_counts: backup.manifest?.table_counts,
        total_records: backup.manifest?.total_records,
      },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backup);
  } catch (error) {
    console.error('School backup error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to create school backup' });
  }
});

router.post('/:id/validate-backup', requireRole('super-admin'), backupUpload.single('backup'), async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.id, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid school id' });

    let payload: unknown = req.body?.backup;
    if (req.file?.buffer) {
      payload = JSON.parse(req.file.buffer.toString('utf8'));
    } else if (typeof req.body?.backup === 'string') {
      payload = JSON.parse(req.body.backup);
    }

    if (!payload) {
      return res.status(400).json({ error: 'Upload a JSON backup file.' });
    }

    const validation = validateSchoolBackup(tenantId, payload);
    res.json(validation);
  } catch (error) {
    console.error('Validate backup error:', error);
    res.status(400).json({ error: (error as Error).message || 'Invalid backup file' });
  }
});

router.post('/:id/import-data', requireRole('super-admin'), backupUpload.single('backup'), async (req: AuthRequest, res) => {
  const tenantId = parseInt(req.params.id, 10);
  if (!tenantId) return res.status(400).json({ error: 'Invalid school id' });

  if (req.body?.type === 'demo') {
    try {
      const tenant = await query('SELECT id, name FROM tenants WHERE id = $1', [tenantId]);
      if (tenant.rows.length === 0) return res.status(404).json({ error: 'School not found' });
      const schoolName = String(tenant.rows[0].name);
      const summary = await importDemoDataForTenant(tenantId);
      emitSystemDataChanged('tenant-data', 'updated', tenantId);
      return res.json({ message: `${schoolName} demo data loaded successfully`, summary });
    } catch (error) {
      console.error('School demo import error:', error);
      return res.status(500).json({ error: (error as Error).message || 'Failed to load demo data' });
    }
  }

  const client = await getClient();
  try {
    const { confirm } = req.body || {};
    if (!tenantId) return res.status(400).json({ error: 'Invalid school id' });
    if (confirm !== 'IMPORT') return res.status(400).json({ error: 'Type IMPORT to confirm this action' });

    let payload: unknown = null;
    if (req.file?.buffer) {
      payload = JSON.parse(req.file.buffer.toString('utf8'));
    } else if (typeof req.body?.backup === 'string') {
      payload = JSON.parse(req.body.backup);
    }
    if (!payload) {
      return res.status(400).json({ error: 'Upload a JSON backup file.' });
    }

    const tenant = await query('SELECT id, name FROM tenants WHERE id = $1', [tenantId]);
    if (tenant.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    const schoolName = String(tenant.rows[0].name);

    const safetyPath = await writeSafetyBackup(tenantId, 'pre-restore');

    await client.query('BEGIN');
    const { imported } = await importSchoolBackup(client, tenantId, payload);
    await client.query('COMMIT');

    await logSchoolDataAction(req, {
      action: 'BACKUP_IMPORT',
      targetTenantId: tenantId,
      schoolName,
      summary: `ScholarNerve restored backup into ${schoolName}`,
      details: { imported, safety_backup_path: safetyPath, timestamp: new Date().toISOString() },
    });

    emitSystemDataChanged('tenant-data', 'updated', tenantId);
    res.json({ message: `${schoolName} data imported successfully`, imported });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('School import error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to import school data' });
  } finally {
    client.release();
  }
});

// Reset one school's data. Only super admins can run this from the Super Admin page.
router.post('/:id/reset-data', requireRole('super-admin'), async (req: AuthRequest, res) => {
  const client = await getClient();
  try {
    const tenantId = parseInt(req.params.id, 10);
    const { confirm, confirmation } = req.body || {};
    if (!tenantId) return res.status(400).json({ error: 'Invalid school id' });
    const expectedCode = `RESET_TENANT_${tenantId}`;
    if (confirmation !== expectedCode && confirm !== 'RESET') {
      return res.status(400).json({
        error: `Invalid confirmation. Pass confirmation: "${expectedCode}" or confirm: "RESET"`,
      });
    }

    const tenant = await client.query('SELECT id, name FROM tenants WHERE id = $1', [tenantId]);
    if (tenant.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    const primaryAdmin = await getPrimaryAdminProfile(client, tenantId);
    const safetyPath = await writeSafetyBackup(tenantId, 'pre-reset');

    await client.query('BEGIN');
    await clearTenantData(client, tenantId, {
      keepTenant: true,
      preserveAccounts: false,
      preserveUserId: primaryAdmin?.id,
    });
    await client.query('COMMIT');

    const preservedAfter = primaryAdmin
      ? await getPrimaryAdminProfile(client, tenantId)
      : null;

    await logSchoolDataAction(req, {
      action: 'FULL_RESET',
      targetTenantId: tenantId,
      schoolName: String(tenant.rows[0].name),
      summary: `FULL RESET performed on ${tenant.rows[0].name} by ${req.user!.username} — operational data deleted; primary admin preserved`,
      details: {
        safety_backup_path: safetyPath,
        timestamp: new Date().toISOString(),
        preserved_admin_id: preservedAfter?.id ?? null,
      },
    });

    emitSystemDataChanged('tenant-data', 'deleted', tenantId);
    res.json({
      message: `${tenant.rows[0].name} data reset successfully`,
      preservedAdmin: preservedAfter
        ? { name: preservedAfter.name, email: preservedAfter.email }
        : null,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Super admin school reset error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to reset school data' });
  } finally {
    client.release();
  }
});

// Soft-removed teachers across all schools (super-admin)
router.get('/removed-teachers', requireRole('super-admin'), async (_req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT t.id, t.tenant_id,
              COALESCE(NULLIF(TRIM(t.removed_original_name), ''), NULLIF(TRIM(t.full_name), ''), '[Unknown]') AS full_name,
              COALESCE(NULLIF(TRIM(t.removed_original_staff_id), ''), t.staff_id) AS staff_id,
              t.deleted_at, t.deletion_type,
              tn.name AS school_name, tn.slug AS school_slug
       FROM teachers t
       JOIN tenants tn ON tn.id = t.tenant_id
       WHERE t.deleted_at IS NOT NULL AND (t.deletion_type = 'soft' OR COALESCE(t.status, '') = 'soft_deleted')
       ORDER BY t.deleted_at DESC NULLS LAST, t.id DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List removed teachers error:', error);
    res.status(500).json({ error: 'Failed to list removed teachers' });
  }
});

router.post('/removed-teachers/:teacherId/restore', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const teacherId = parseInt(req.params.teacherId, 10);
    const tenantId = parseInt(String(req.body?.tenantId ?? req.query.tenantId ?? ''), 10);
    if (!teacherId || !tenantId) {
      return res.status(400).json({ error: 'tenantId and teacherId required' });
    }
    const result = await restoreTeacher(tenantId, teacherId);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'RESTORE',
      entityType: 'TEACHER',
      entityId: teacherId,
      module: 'superadmin',
      summary: 'Super admin restored soft-deleted teacher to school lists',
      details: result,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitSystemDataChanged('tenant-data', 'updated', tenantId);
    res.json({ message: 'Teacher restored to school', ...result });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ error: error.message });
    console.error('Restore removed teacher error:', error);
    res.status(500).json({ error: 'Failed to restore teacher' });
  }
});

router.post('/removed-teachers/:teacherId/permanent-delete', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const teacherId = parseInt(req.params.teacherId, 10);
    const tenantId = parseInt(String(req.body?.tenantId ?? req.query.tenantId ?? ''), 10);
    if (!teacherId || !tenantId) {
      return res.status(400).json({ error: 'tenantId and teacherId required' });
    }
    const result = await permanentlyRemoveTeacher(tenantId, teacherId);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'HARD_DELETE',
      entityType: 'TEACHER',
      entityId: teacherId,
      module: 'superadmin',
      summary: 'Super admin permanently removed soft-deleted teacher record',
      details: result,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    res.json({ message: 'Teacher permanently removed', ...result });
  } catch (error: any) {
    const status = error?.status || 500;
    if (status !== 500) return res.status(status).json({ error: error.message });
    console.error('Permanent delete removed teacher error:', error);
    res.status(500).json({ error: 'Failed to permanently remove teacher' });
  }
});

// Tenant overview with live counts (super-admin) — must be before /:id
router.get('/:id/overview', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.id, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid school id' });

    const tenant = await query(
      `SELECT id, name, slug, subdomain, logo_url, primary_color, secondary_color,
              subscription_status, is_active, archived_at, created_at, updated_at
       FROM tenants WHERE id = $1`,
      [tenantId]
    );
    if (tenant.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    const counts = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM students WHERE tenant_id = $1) AS students,
         (SELECT COUNT(*)::int FROM teachers t WHERE t.tenant_id = $1 AND ${TEACHER_COUNTABLE_WHERE}) AS teachers,
         (SELECT COUNT(*)::int FROM other_staff o WHERE o.tenant_id = $1 AND ${OTHER_STAFF_COUNTABLE_WHERE}) AS other_staff,
         (SELECT COUNT(*)::int FROM users WHERE tenant_id = $1) AS users,
         (SELECT COUNT(*)::int FROM classes WHERE tenant_id = $1) AS classes,
         (SELECT COUNT(*)::int FROM payments WHERE tenant_id = $1) AS payments,
         (SELECT COUNT(*)::int FROM parent_portal_accounts WHERE tenant_id = $1) AS parent_accounts`,
      [tenantId]
    );

    const admin = await query(
      `SELECT id, username, email, full_name, phone, created_at
       FROM users
       WHERE tenant_id = $1 AND is_primary_admin = true
       LIMIT 1`,
      [tenantId]
    );

    const settings = await query(
      `SELECT email, phone_number, contact_phone, current_year, current_term, physical_address
       FROM school_settings WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    ).catch(() => ({ rows: [] }));

    const row = counts.rows[0] || {};
    res.json({
      ...tenant.rows[0],
      stats: {
        students: Number(row.students ?? 0),
        teachers: Number(row.teachers ?? 0),
        other_staff: Number(row.other_staff ?? 0),
        users: Number(row.users ?? 0),
        classes: Number(row.classes ?? 0),
        payments: Number(row.payments ?? 0),
        parent_accounts: Number(row.parent_accounts ?? 0),
      },
      primary_admin: admin.rows[0] || null,
      school_settings: settings.rows[0] || null,
    });
  } catch (error) {
    console.error('School overview error:', error);
    res.status(500).json({ error: 'Failed to fetch school overview' });
  }
});

// Get single school (also used by school admins for their own school - allow with tenant context)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authReq = req as AuthRequest;
    const tenantId = parseInt(id, 10);
    
    if (authReq.user?.role !== 'super-admin' && authReq.user?.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await query(
      `SELECT id, name, slug, subdomain, logo_url, primary_color, secondary_color,
              subscription_status, is_active, is_demo, created_at, updated_at
       FROM tenants WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get school error:', error);
    res.status(500).json({ error: 'Failed to fetch school' });
  }
});

// Create new school (super-admin only)
router.post('/', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { name, slug, subdomain, adminUsername, adminPassword, adminEmail, primary_color, secondary_color } = req.body;
    
    if (!name || !adminUsername || !adminPassword) {
      return res.status(400).json({ error: 'School name, admin username, and password are required' });
    }
    
    if (adminPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const client = await (await import('../db/connection.js')).getClient();
    
    try {
      await client.query('BEGIN');

      const slugResolved = await resolveTenantSlugForCreate(client, { name, slug, subdomain });
      if ('error' in slugResolved) {
        await client.query('ROLLBACK');
        return res.status(slugResolved.status).json({ error: slugResolved.error });
      }
      const { slug: finalSlug, subdomain: finalSubdomain } = slugResolved;
      
      const tenantResult = await client.query(
        `INSERT INTO tenants (name, slug, subdomain, primary_color, secondary_color, subscription_status, is_active)
         VALUES ($1, $2, $3, $4, $5, 'active', true) RETURNING id`,
        [name, finalSlug, finalSubdomain, primary_color || null, secondary_color || null]
      );
      
      const tenantId = tenantResult.rows[0].id;
      
      // Create admin user (first admin = primary for this school)
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      try {
        await client.query(
          'INSERT INTO users (tenant_id, username, email, password_hash, role, is_primary_admin) VALUES ($1, $2, $3, $4, $5, true)',
          [tenantId, adminUsername, adminEmail || null, hashedPassword, 'administrator']
        );
      } catch (userErr: any) {
        if (userErr.code === '42703') {
          await client.query(
            'INSERT INTO users (tenant_id, username, password_hash, role) VALUES ($1, $2, $3, $4)',
            [tenantId, adminUsername, hashedPassword, 'administrator']
          );
        } else {
          throw userErr;
        }
      }
      
      // Create default school settings
      await client.query(
        'INSERT INTO school_settings (tenant_id, school_name) VALUES ($1, $2)',
        [tenantId, name]
      );

      // Seed first academic year on same connection (visible within transaction)
      const yearStart = new Date().getFullYear();
      const yearLabel = `${yearStart}/${yearStart + 1}`;
      const ay = await client.query(
        `INSERT INTO academic_years (tenant_id, name, is_current)
         VALUES ($1, $2, true) RETURNING id`,
        [tenantId, yearLabel]
      ).catch(() => ({ rows: [] as { id: number }[] }));
      if (ay.rows[0]?.id) {
        await client.query(
          `INSERT INTO terms (tenant_id, academic_year_id, name, is_current)
           VALUES ($1, $2, 'Term 1', true)`,
          [tenantId, ay.rows[0].id]
        ).catch(() => undefined);
      }

      await client.query('COMMIT');

      // After commit — other pool connections can see the tenant (FK-safe)
      try {
        await ensureSetupProgressRow(tenantId);
      } catch (setupErr) {
        console.warn('setup progress row (non-fatal):', (setupErr as Error)?.message);
      }
      try {
        const { bootstrapTenantChat } = await import('../services/chatService.js');
        await bootstrapTenantChat(tenantId);
      } catch (chatErr) {
        console.warn('chat channel setup (non-fatal):', (chatErr as Error)?.message);
      }
      
      // Log creation
      await query(
        'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES (NULL, $1, $2, $3, $4)',
        [req.user!.id, 'CREATE', 'TENANT', tenantId]
      );
      emitSystemDataChanged('school', 'created', tenantId);
      
      res.status(201).json({
        id: tenantId,
        name,
        slug: finalSlug,
        subdomain: finalSubdomain,
        message: 'School created successfully',
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
        return res.status(409).json({ error: formatTenantSlugConflictError(error) });
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Create school error:', error?.message || error, error?.code, error?.detail);
    const hint =
      error?.code === '23503'
        ? 'Database schema may be out of date — run npm run schema:ensure on the server.'
        : undefined;
    res.status(500).json({
      error: 'Failed to create school',
      ...(hint ? { hint } : {}),
    });
  }
});

// Upload school logo
router.post('/:id/logo', requireRole('super-admin'), upload.single('logo'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    // Convert to Base64
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    await query(
      `UPDATE tenants SET logo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [base64Image, id]
    );
    await syncSchoolSettingsFromTenant(parseInt(id, 10), { logo_url: base64Image });
    res.json({ logoUrl: base64Image });
  } catch (error) {
    console.error('Upload school logo error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// Update school (identity, portal URL, branding, primary admin — safe while users are online)
router.put('/:id', requireRole('super-admin'), async (req: AuthRequest, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const tenantId = parseInt(id, 10);
    const {
      name,
      slug,
      subdomain,
      logo_url,
      primary_color,
      secondary_color,
      subscription_status,
      is_active,
      adminUsername,
      adminEmail,
      adminFullName,
      adminPhone,
      adminNewPassword,
    } = req.body;

    const slugCheck = await resolveTenantSlugForUpdate(client, tenantId, { slug, subdomain });
    if ('error' in slugCheck) {
      return res.status(slugCheck.status).json({ error: slugCheck.error });
    }

    const nextSlug = slugCheck.slug ?? (slug ? String(slug).trim() : undefined);
    const nextSubdomain = slugCheck.subdomain ?? nextSlug ?? (subdomain ? String(subdomain).trim() : undefined);

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE tenants SET 
        name = COALESCE($1, name),
        slug = COALESCE($2, slug),
        subdomain = COALESCE($3, subdomain),
        logo_url = COALESCE($4, logo_url),
        primary_color = COALESCE($5, primary_color),
        secondary_color = COALESCE($6, secondary_color),
        subscription_status = COALESCE($7, subscription_status),
        is_active = COALESCE($8, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING *`,
      [name, nextSlug, nextSubdomain, logo_url, primary_color, secondary_color, subscription_status, is_active, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'School not found' });
    }

    if (name) {
      await client.query(
        `UPDATE school_settings SET school_name = $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2`,
        [name, tenantId]
      ).catch(() => undefined);
    }

    const adminFieldsProvided =
      adminUsername != null ||
      adminEmail != null ||
      adminFullName != null ||
      adminPhone != null ||
      adminNewPassword;

    if (adminFieldsProvided) {
      if (adminNewPassword && String(adminNewPassword).length > 0 && String(adminNewPassword).length < 6) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }
      const adminRes = await client.query(
        `SELECT id, username FROM users WHERE tenant_id = $1 AND is_primary_admin = true LIMIT 1`,
        [tenantId]
      );
      if (adminRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'No primary admin found for this school' });
      }
      const adminId = adminRes.rows[0].id;
      const nextUsername = adminUsername != null ? String(adminUsername).trim() : null;
      if (nextUsername) {
        const dup = await client.query(
          `SELECT id FROM users WHERE tenant_id = $1 AND LOWER(username) = LOWER($2) AND id <> $3 LIMIT 1`,
          [tenantId, nextUsername, adminId]
        );
        if (dup.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'That admin username is already used in this school.' });
        }
      }
      const passwordHash =
        adminNewPassword && String(adminNewPassword).length >= 6
          ? await bcrypt.hash(String(adminNewPassword), 10)
          : null;
      await client.query(
        `UPDATE users SET
          username = COALESCE($1, username),
          email = COALESCE($2, email),
          full_name = COALESCE($3, full_name),
          phone = COALESCE($4, phone),
          password_hash = COALESCE($5, password_hash),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [
          nextUsername || null,
          adminEmail != null ? String(adminEmail).trim() || null : null,
          adminFullName != null ? String(adminFullName).trim() || null : null,
          adminPhone != null ? String(adminPhone).trim() || null : null,
          passwordHash,
          adminId,
        ]
      );
    }

    await client.query('COMMIT');

    if (logo_url) {
      await syncSchoolSettingsFromTenant(tenantId, { logo_url });
    }
    if (name) {
      await syncSchoolSettingsFromTenant(tenantId, { name });
    }

    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES (NULL, $1, $2, $3, $4)',
      [req.user!.id, 'UPDATE', 'TENANT', tenantId]
    );
    emitSystemDataChanged('school', 'updated', tenantId);

    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Update school error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: formatTenantSlugConflictError(error) });
    }
    res.status(500).json({ error: 'Failed to update school' });
  } finally {
    client.release();
  }
});

// Activate school
router.post('/:id/activate', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE tenants SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    emitSystemDataChanged('school', 'updated', parseInt(id));
    res.json({ message: 'School activated' });
  } catch (error) {
    console.error('Activate school error:', error);
    res.status(500).json({ error: 'Failed to activate school' });
  }
});

// Deactivate/Suspend school
router.post('/:id/deactivate', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE tenants SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    emitSystemDataChanged('school', 'updated', parseInt(id));
    res.json({ message: 'School deactivated' });
  } catch (error) {
    console.error('Deactivate school error:', error);
    res.status(500).json({ error: 'Failed to deactivate school' });
  }
});

// Archive school (soft-remove from login; data retained for restore)
router.post('/:id/archive', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.id, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid school id' });

    const tenant = await query('SELECT id, name, archived_at FROM tenants WHERE id = $1', [tenantId]);
    if (tenant.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    if (tenant.rows[0].archived_at) {
      return res.json({ message: 'School is already archived', id: tenantId });
    }

    await query(
      `UPDATE tenants
       SET archived_at = CURRENT_TIMESTAMP,
           archived_by = $1,
           is_active = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [req.user!.id, tenantId]
    );

    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES (NULL, $1, $2, $3, $4, $5)',
      [req.user!.id, 'ARCHIVE', 'TENANT', tenantId, JSON.stringify({ schoolName: tenant.rows[0].name })]
    );
    emitSystemDataChanged('school', 'updated', tenantId);

    res.json({ message: 'School archived successfully', id: tenantId });
  } catch (error) {
    console.error('Archive school error:', error);
    res.status(500).json({ error: 'Failed to archive school' });
  }
});

// Restore archived school
router.post('/:id/restore', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.id, 10);
    if (!tenantId) return res.status(400).json({ error: 'Invalid school id' });

    const tenant = await query('SELECT id, name, archived_at FROM tenants WHERE id = $1', [tenantId]);
    if (tenant.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    await query(
      `UPDATE tenants
       SET archived_at = NULL,
           archived_by = NULL,
           is_active = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [tenantId]
    );

    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES (NULL, $1, $2, $3, $4, $5)',
      [req.user!.id, 'RESTORE', 'TENANT', tenantId, JSON.stringify({ schoolName: tenant.rows[0].name })]
    );
    emitSystemDataChanged('school', 'updated', tenantId);

    res.json({ message: 'School restored successfully', id: tenantId });
  } catch (error) {
    console.error('Restore school error:', error);
    res.status(500).json({ error: 'Failed to restore school' });
  }
});

// Delete school
router.delete('/:id', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const result = await query('DELETE FROM tenants WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    // Log deletion
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES (NULL, $1, $2, $3, $4)',
      [req.user!.id, 'DELETE', 'TENANT', parseInt(id)]
    );
    emitSystemDataChanged('school', 'deleted', parseInt(id));
    
    res.json({ message: 'School deleted successfully' });
  } catch (error) {
    console.error('Delete school error:', error);
    res.status(500).json({ error: 'Failed to delete school' });
  }
});

// Reset primary admin password (super-admin only)
router.post('/:id/reset-password', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const tenantCheck = await query('SELECT id FROM tenants WHERE id = $1', [id]);
    if (tenantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const userResult = await query(
      'SELECT id FROM users WHERE tenant_id = $1 AND is_primary_admin = true LIMIT 1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No primary admin found for this school' });
    }

    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, userResult.rows[0].id]
    );

    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES (NULL, $1, $2, $3, $4)',
      [req.user!.id, 'RESET_PASSWORD', 'USER', userResult.rows[0].id]
    );
    emitSystemDataChanged('user', 'updated', parseInt(id));

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get school users
router.get('/:id/users', requireRole('super-admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT id, username, email, role, teacher_id, is_active, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get school users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user for school
router.post('/:id/users', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { username, password, email, role, teacherId } = req.body;
    
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password, and role are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await query(
      'INSERT INTO users (tenant_id, username, email, password_hash, role, teacher_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email, role',
      [id, username, email || null, hashedPassword, role, teacherId || null]
    );
    
    // Log creation
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [parseInt(id), req.user!.id, 'CREATE', 'USER', result.rows[0].id]
    );
    emitSystemDataChanged('user', 'created', parseInt(id));
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Create user error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

function resolveTemplateTenantId(req: AuthRequest, schoolId: number): number | null {
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'super-admin') return schoolId;
  if (req.user?.tenantId === schoolId) return schoolId;
  return null;
}

router.get('/:id/id-card-template', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const schoolId = parseInt(req.params.id, 10);
    const tenantId = resolveTemplateTenantId(req, schoolId);
    if (!tenantId) return res.status(403).json({ error: 'Not allowed' });
    const ctx = await getSchoolCardContext(tenantId);
    const template = await getIdCardTemplate(tenantId);
    const schoolName = String(ctx?.school_name || ctx?.tenant_name || 'School');
    res.json({ schoolName, ...mapTemplateToApi(template) });
  } catch (error) {
    console.error('Get school ID card template error:', error);
    res.status(500).json({ error: 'Failed to load template' });
  }
});

router.patch('/:id/id-card-template', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const schoolId = parseInt(req.params.id, 10);
    const tenantId = resolveTemplateTenantId(req, schoolId);
    if (!tenantId) return res.status(403).json({ error: 'Not allowed' });
    const instructions = req.body?.instructions ?? req.body?.studentInstructions ?? req.body?.staffInstructions;
    const updated = await updateIdCardTemplate(tenantId, 'SCHOOL', {
      primary_color: req.body?.primaryColor,
      accent_color: req.body?.accentColor,
      footer_bg: req.body?.footerBg,
      powered_by_color: req.body?.poweredByColor,
      school_slogan: req.body?.schoolSlogan,
      school_phone: req.body?.schoolPhone,
      school_website: req.body?.schoolWebsite,
      school_code: req.body?.schoolCode,
      school_email: req.body?.schoolEmail,
      back_header_text: req.body?.backHeaderText,
      ...(Array.isArray(instructions) ? { instructions } : {}),
    });
    const ctx = await getSchoolCardContext(tenantId);
    const schoolName = String(ctx?.school_name || ctx?.tenant_name || 'School');
    res.json({ schoolName, ...mapTemplateToApi(updated) });
  } catch (error) {
    console.error('Update school ID card template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

export default router;
