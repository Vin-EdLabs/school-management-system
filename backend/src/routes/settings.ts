import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { query } from '../db/connection.js';
import bcrypt from 'bcryptjs';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole, requirePrimaryAdminOrSuperAdmin } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { resolveLedgerTermFromSettings, postFeesForNewTerm, postFeesForNewTermWithArrears } from '../services/ledgerFinanceService.js';
import { isLedgerTermClosed } from '../services/termCloseService.js';
import { getIO } from '../socket.js';
import {
  sendPushToTenantParents,
  sendPushToStudentsParents,
  sendPushToClassParents,
  sendPushToTenantStaff,
} from '../services/webPushService.js';
import { isFcmConfigured } from '../services/fcmService.js';
import { notifySetupProgressChanged } from '../services/setupProgressService.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import { resolveActorFromRequest, resolveUserDisplayName, withActor } from '../utils/auditResolve.js';
import { ensureAllTeacherUserAccounts } from '../services/teacherUserService.js';
import { healSchoolBrandingMismatch } from '../services/schoolBrandingService.js';

const router = express.Router();

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit for Base64
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// All routes require authentication and tenant context
router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

// Settings is never term-locked — admins must always manage school identity and academic terms here.

// Get school settings
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    
    const result = await query(
      'SELECT * FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    
    if (result.rows.length === 0) {
      // Create default settings if they don't exist
      const tenantRes = await query('SELECT name FROM tenants WHERE id = $1', [tenantId]);
      const defaultName = tenantRes.rows[0]?.name || 'School';
      await query(
        'INSERT INTO school_settings (tenant_id, school_name) VALUES ($1, $2)',
        [tenantId, defaultName]
      );
      
      const newResult = await query(
        'SELECT * FROM school_settings WHERE tenant_id = $1',
        [tenantId]
      );
      return res.json(newResult.rows[0]);
    }

    await healSchoolBrandingMismatch(tenantId);
    const healed = await query(
      `SELECT ss.*,
              COALESCE(NULLIF(TRIM(t.name), ''), NULLIF(TRIM(ss.school_name), ''), 'School') AS school_name,
              COALESCE(NULLIF(TRIM(ss.logo_url), ''), NULLIF(TRIM(t.logo_url), '')) AS logo_url
       FROM school_settings ss
       JOIN tenants t ON t.id = ss.tenant_id
       WHERE ss.tenant_id = $1`,
      [tenantId]
    );
    
    res.json(healed.rows[0] || result.rows[0]);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update school settings (primary admin or super-admin)
router.put('/', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { school_name, address, contact, email, current_year, current_term, primary_color, secondary_color,
      receipt_prefix, postal_address, contact_phone, receipt_footer, bank_details,
      phone_number, whatsapp_number, office_hours, physical_address } = req.body;
    const skipAutoPost = (req.body as any).skip_auto_post === true;

    const isTermChange = current_year !== undefined || current_term !== undefined;
    let previousYear: string | undefined;
    let previousTerm: string | undefined;
    if (isTermChange) {
      const existing = await query(
        'SELECT current_year, current_term FROM school_settings WHERE tenant_id = $1',
        [tenantId]
      );
      previousYear = existing.rows[0]?.current_year;
      previousTerm = existing.rows[0]?.current_term;
    }

    const result = await query(
      `UPDATE school_settings 
       SET school_name = COALESCE($1, school_name),
           address = COALESCE($2, address),
           contact = COALESCE($3, contact),
           email = COALESCE($4, email),
           current_year = COALESCE($5, current_year),
           current_term = COALESCE($6, current_term),
           receipt_prefix = COALESCE($7, receipt_prefix),
           postal_address = COALESCE($8, postal_address),
           contact_phone = COALESCE($9, contact_phone),
           receipt_footer = COALESCE($10, receipt_footer),
           bank_details = COALESCE($11, bank_details),
           phone_number = COALESCE($12, phone_number),
           whatsapp_number = COALESCE($13, whatsapp_number),
           office_hours = COALESCE($14, office_hours),
           physical_address = COALESCE($15, physical_address),
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $16
       RETURNING *`,
      [
        school_name, address, contact, email, current_year, current_term,
        receipt_prefix, postal_address, contact_phone, receipt_footer, bank_details,
        phone_number, whatsapp_number, office_hours, physical_address,
        tenantId
      ]
    );
    
    await query(
      `UPDATE tenants SET 
         name = COALESCE($1, name),
         primary_color = COALESCE($2, primary_color),
         secondary_color = COALESCE($3, secondary_color),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [school_name || null, primary_color || null, secondary_color || null, tenantId]
    );
    
    if (result.rows.length === 0) {
      // Create if doesn't exist
      const insertResult = await query(
        `INSERT INTO school_settings (
          tenant_id, school_name, address, contact, email, current_year, current_term,
          phone_number, whatsapp_number, office_hours, physical_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          tenantId, school_name || 'School', address, contact, email, current_year, current_term,
          phone_number || contact_phone || contact || null,
          whatsapp_number || null,
          office_hours || null,
          physical_address || address || postal_address || null
        ]
      );
      const saved = insertResult.rows[0];
      const year = saved?.current_year ?? current_year;
      const term = saved?.current_term ?? current_term;
      if (year && term) {
        try {
          const ledgerTerm = await resolveLedgerTermFromSettings(tenantId, year, term);
          if (ledgerTerm) {
            await postFeesForNewTerm(tenantId, ledgerTerm.termId);
          }
        } catch (err) {
          console.error('[Settings] Auto-post new term fees failed:', err);
        }
      }
      emitTenantDataChanged(tenantId, 'settings', 'updated');
      return res.json(saved);
    }
    
    const saved = result.rows[0];
    const newYear = saved?.current_year ?? current_year;
    const newTerm = saved?.current_term ?? current_term;

    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'SETTINGS',
      module: 'settings',
      summary: withActor(
        `School settings updated${newTerm && newYear ? ` — active term set to ${newTerm} ${newYear}` : ''}`,
        actor
      ),
      details: { current_term: newTerm, current_year: newYear },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });

    const currentTermId = req.body.current_term_id ? parseInt(String(req.body.current_term_id), 10) : null;
    const newTermId = req.body.new_term_id ? parseInt(String(req.body.new_term_id), 10) : null;

    // If skipAutoPost is true, do NOT trigger any automatic fee/arrears posting here.
    // This allows frontend flows to call /finance/switch-term directly and have
    // all arrears/fees logic handled in one place.
    if (!skipAutoPost) {
      // If term IDs are provided directly, use them (ID-based switching)
      if (isTermChange && currentTermId && newTermId && currentTermId !== newTermId) {
        try {
          const postResult = await postFeesForNewTermWithArrears(tenantId, currentTermId, newTermId);
          console.log('[Settings] Auto-posted new term fees and arrears using term IDs:', postResult);
        } catch (err) {
          console.error('[Settings] Auto-post using term IDs failed (settings saved):', err);
        }
      } else if (newYear && newTerm) {
        // Fallback: resolve from names (for backward compatibility)
        try {
          const newLedgerTerm = await resolveLedgerTermFromSettings(tenantId, newYear, newTerm);
          if (newLedgerTerm) {
            const actuallyChanged = isTermChange && (previousYear !== newYear || previousTerm !== newTerm);
            if (actuallyChanged && previousYear && previousTerm) {
              const previousLedgerTerm = await resolveLedgerTermFromSettings(tenantId, previousYear, previousTerm);
              if (previousLedgerTerm && previousLedgerTerm.termId !== newLedgerTerm.termId) {
                const postResult = await postFeesForNewTermWithArrears(
                  tenantId,
                  previousLedgerTerm.termId,
                  newLedgerTerm.termId
                );
                console.log('[Settings] Auto-posted new term fees and arrears on term switch:', postResult);
              } else {
                await postFeesForNewTerm(tenantId, newLedgerTerm.termId);
                console.log('[Settings] Auto-posted new term fees on term switch.');
              }
            } else {
              const postResult = await postFeesForNewTerm(tenantId, newLedgerTerm.termId);
              console.log('[Settings] Auto-posted new term fees on term switch:', postResult);
            }
          }
        } catch (err) {
          console.error('[Settings] Auto-post new term fees failed (settings saved):', err);
        }
      }
    }

    // Auto-refresh arrears in background whenever settings change (especially term changes)
    (async () => {
      try {
        const { refreshArrearsForTenant } = await import('../services/arrearsService.js');
        await refreshArrearsForTenant(tenantId);
        console.log(`[settings] Arrears refreshed for tenant ${tenantId} due to settings update`);
      } catch (err) {
        console.error('[settings] Failed to auto-refresh arrears on settings update:', err);
      }
    })();

    emitTenantDataChanged(tenantId, 'settings', 'updated');
    res.json(saved ?? result.rows[0]);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Upload logo (primary admin or super-admin)
router.post('/logo', requirePrimaryAdminOrSuperAdmin, upload.single('logo'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const tenantId = req.user!.tenantId!;
    // Convert to Base64
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    // Update logo URL in school_settings and tenants for consistent branding
    await query(
      'UPDATE school_settings SET logo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2',
      [base64Image, tenantId]
    );
    await query(
      'UPDATE tenants SET logo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [base64Image, tenantId]
    );
    
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'SETTINGS',
      module: 'settings',
      summary: withActor('School logo updated', actor),
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'settings', 'updated');
    res.json({ logoUrl: base64Image });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// Get academic terms (archived hidden unless include_archived=true)
router.get('/academic-terms', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const includeArchived =
      req.query.include_archived === 'true' || req.query.include_archived === '1';

    const result = await query(
      includeArchived
        ? `SELECT * FROM academic_terms WHERE tenant_id = $1 ORDER BY year DESC, start_date DESC`
        : `SELECT * FROM academic_terms
           WHERE tenant_id = $1
             AND (COALESCE(is_archived, false) = false OR is_active = true)
           ORDER BY year DESC, start_date DESC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get academic terms error:', error);
    res.status(500).json({ error: 'Failed to fetch academic terms' });
  }
});

// Create academic term (primary admin or super-admin)
router.post('/academic-terms', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { term_name, year, start_date, end_date, is_active } = req.body;
    
    if (!term_name || !year) {
      return res.status(400).json({ error: 'Term name and year are required' });
    }
    
    // If setting as active, deactivate others
    if (is_active) {
      await query(
        'UPDATE academic_terms SET is_active = false WHERE tenant_id = $1',
        [tenantId]
      );
    }
    
    const result = await query(
      'INSERT INTO academic_terms (tenant_id, term_name, year, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [tenantId, term_name, year, start_date || null, end_date || null, is_active || false]
    );
    
    // MANDATORY: Always create corresponding ledger term when academic term is created
    // This ensures ledger terms exist BEFORE switching, preventing errors
    try {
      const ledgerTerm = await resolveLedgerTermFromSettings(tenantId, year, term_name);
      if (!ledgerTerm) {
        throw new Error(`CRITICAL: Failed to create ledger term for ${term_name} ${year}. Term switching will fail without this.`);
      }
      
      // If setting as active, update ledger term flags
      if (is_active && ledgerTerm) {
        await query('UPDATE terms SET is_current = false WHERE tenant_id = $1', [tenantId]);
        await query('UPDATE terms SET is_current = true WHERE id = $1', [ledgerTerm.termId]);
      }
    } catch (err: any) {
      console.error('[Settings] CRITICAL: Failed to create ledger term for new academic term:', err);
      throw new Error(`CRITICAL: Cannot create academic term without corresponding ledger term. ${err?.message || 'Unknown error'}`);
    }
    
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'CREATE',
      entityType: 'ACADEMIC_TERM',
      entityId: result.rows[0].id,
      module: 'settings',
      summary: withActor(`Academic term created — ${term_name} ${year}`, actor),
      details: { term_name, year },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'academic-term', 'created');
    notifySetupProgressChanged(tenantId);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create academic term error:', error);
    res.status(500).json({ error: 'Failed to create academic term' });
  }
});

// Update academic term (primary admin or super-admin)
router.put('/academic-terms/:id', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { term_name, year, start_date, end_date, is_active, is_archived } = req.body;

    if (is_archived === true) {
      const current = await query(
        'SELECT is_active FROM academic_terms WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      if (current.rows.length === 0) {
        return res.status(404).json({ error: 'Academic term not found' });
      }
      if (current.rows[0].is_active) {
        return res.status(400).json({ error: 'Cannot archive the currently active term. Mark it inactive first.' });
      }
    }

    if (is_active) {
      const previousActive = await query(
        `SELECT term_name, year FROM academic_terms
         WHERE tenant_id = $1 AND is_active = true AND id != $2`,
        [tenantId, id]
      );
      if (previousActive.rows.length > 0) {
        const prev = previousActive.rows[0];
        const year = String(prev.year || '').trim();
        const termName = String(prev.term_name || '').trim();
        const fullLabel = year && !termName.includes(year) ? `${termName} ${year}`.trim() : termName;
        const resolved = await resolveLedgerTermFromSettings(tenantId, year, fullLabel);
        if (resolved?.termId) {
          const closed = await isLedgerTermClosed(tenantId, resolved.termId);
          if (!closed) {
            return res.status(400).json({
              error:
                'Close the current term before activating another. Go to Settings → Academic Terms → Close Term.',
            });
          }
        }
      }

      await query(
        'UPDATE academic_terms SET is_active = false WHERE tenant_id = $1 AND id != $2',
        [tenantId, id]
      );
    }

    const archivedValue =
      is_active === true ? false : is_archived === true ? true : is_archived === false ? false : null;

    const result = await query(
      `UPDATE academic_terms 
       SET term_name = COALESCE($1, term_name),
           year = COALESCE($2, year),
           start_date = COALESCE($3, start_date),
           end_date = COALESCE($4, end_date),
           is_active = COALESCE($5, is_active),
           is_archived = COALESCE($6, is_archived),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [term_name, year, start_date, end_date, is_active, archivedValue, id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Academic term not found' });
    }
    
    const updatedTerm = result.rows[0];
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'ACADEMIC_TERM',
      entityId: parseInt(id, 10),
      module: 'settings',
      summary: withActor(
        `Academic term updated — ${updatedTerm.term_name} ${updatedTerm.year}`,
        actor
      ),
      details: { term_name: updatedTerm.term_name, year: updatedTerm.year },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'academic-term', 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update academic term error:', error);
    res.status(500).json({ error: 'Failed to update academic term' });
  }
});

// Archive all inactive, non-archived terms (keeps active term visible)
router.post('/academic-terms/archive-all', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;

    const result = await query(
      `UPDATE academic_terms
       SET is_archived = true, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $1
         AND is_active = false
         AND COALESCE(is_archived, false) = false
       RETURNING id, term_name, year`,
      [tenantId]
    );

    emitTenantDataChanged(tenantId, 'academic-term', 'updated');
    res.json({
      message: `${result.rowCount} term(s) archived.`,
      archivedCount: result.rowCount,
      terms: result.rows,
    });
  } catch (error) {
    console.error('Archive all academic terms error:', error);
    res.status(500).json({ error: 'Failed to archive terms' });
  }
});

// Academic terms are historical anchors and must not be deleted.
router.delete('/academic-terms/:id', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  return res.status(405).json({ error: 'Academic terms cannot be deleted. Mark the term inactive instead.' });
});

// Get school users - all staff with names (primary admin or super-admin)
router.get('/users', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required' });

    await ensureAllTeacherUserAccounts(tenantId).catch((err) => {
      console.warn('[settings/users] Teacher user sync warning:', (err as Error).message);
    });

    const result = await query(
      `SELECT u.id, u.username, COALESCE(u.email, t.email) as email, u.role, u.teacher_id, u.other_staff_id, u.is_active, u.is_primary_admin, u.created_at,
        COALESCE(t.full_name, s.full_name, u.full_name, u.username) as full_name,
        COALESCE(t.staff_id, s.staff_id) as staff_id
       FROM users u
       LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
       LEFT JOIN other_staff s ON u.other_staff_id = s.id AND s.tenant_id = u.tenant_id
       WHERE u.tenant_id = $1
         AND (u.teacher_id IS NULL OR (t.deleted_at IS NULL AND COALESCE(t.is_deleted, false) = false))
         AND (u.other_staff_id IS NULL OR COALESCE(s.is_deleted, false) = false)
       ORDER BY
         CASE u.role WHEN 'super-admin' THEN 0 WHEN 'administrator' THEN 1 WHEN 'headmaster' THEN 2 WHEN 'finance' THEN 3 WHEN 'teacher' THEN 4 WHEN 'staff' THEN 5 ELSE 6 END,
        COALESCE(t.full_name, s.full_name, u.full_name, u.username)`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get school users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Reset password for any user (primary admin or super-admin)
router.post('/users/:id/reset-password', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { newPassword } = req.body;
    
    // Get target user role to decide minLength
    const targetUser = await query(
      'SELECT id, role, username, full_name FROM users WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User teacher not found' });
    }
    
    const targetRole = targetUser.rows[0].role;
    const minLength =
      targetRole === 'teacher' || targetRole === 'staff' || targetRole === 'headmaster' ? 5 : 6;

    if (!newPassword || newPassword.length < minLength) {
      return res.status(400).json({ error: `New password must be at least ${minLength} characters` });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashed, id]
    );
    const targetLabel =
      String(targetUser.rows[0].full_name || '').trim() ||
      (await resolveUserDisplayName(parseInt(id, 10)));
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'RESET_PASSWORD',
      entityType: 'USER',
      entityId: parseInt(id, 10),
      module: 'settings',
      summary: withActor(`Password reset for ${targetLabel}`, actor),
      details: { username: targetUser.rows[0].username, fullName: targetLabel },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'user', 'updated');
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Create school user (primary admin or super-admin)
router.post('/users', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const { username, password, email, role, teacherId, fullName } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password, and role are required' });
    }
    if (!['administrator', 'finance', 'teacher', 'staff', 'driver', 'headmaster'].includes(role)) {
      return res.status(400).json({ error: 'Role must be administrator, finance, teacher, staff, driver, or headmaster' });
    }
    const minLength = role === 'teacher' || role === 'staff' || role === 'driver' || role === 'headmaster' ? 5 : 6;
    if (password.length < minLength) {
      return res.status(400).json({ error: `Password must be at least ${minLength} characters` });
    }
    if ((role === 'administrator' || role === 'finance' || role === 'headmaster') && !String(fullName || '').trim()) {
      return res.status(400).json({ error: 'Full name is required for Administrator, Finance, and Headmaster users' });
    }
    if (role === 'headmaster' && !teacherId) {
      return res.status(400).json({ error: 'Headmaster accounts must be linked to a teacher profile (teacherId)' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (tenant_id, username, full_name, email, password_hash, role, teacher_id, other_staff_id, is_primary_admin) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) RETURNING id, username, full_name, email, role, is_active, is_primary_admin',
      [tenantId, username, String(fullName || '').trim() || null, email || null, hashedPassword, role, teacherId || null, req.body.otherStaffId || null]
    );

    const created = result.rows[0];
    const userLabel = String(created.full_name || created.username || username).trim();
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'CREATE',
      entityType: 'USER',
      entityId: created.id,
      module: 'settings',
      summary: withActor(`User account created — ${userLabel} (${role})`, actor),
      details: { username: created.username, fullName: userLabel, role },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'user', 'created');
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Create school user error:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update editable school user details (primary admin or super-admin)
router.patch('/users/:id', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required' });
    const { id } = req.params;
    const { role, isActive, fullName, email } = req.body;

    const userCheck = await query(
      'SELECT id, role, is_primary_admin, teacher_id FROM users WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const target = userCheck.rows[0];
    const changingRole = role !== undefined && role !== target.role;
    const changingStatus = isActive !== undefined;

    if (target.is_primary_admin && (changingRole || changingStatus)) {
      return res.status(400).json({ error: 'The primary Scholarnerve admin role/status cannot be changed' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (role !== undefined) {
      const teacherLinked = target.teacher_id != null && String(target.teacher_id).trim() !== '';
      const isTeachingRoleSwap =
        teacherLinked &&
        ((target.role === 'teacher' && role === 'headmaster') ||
          (target.role === 'headmaster' && role === 'teacher'));

      if (isTeachingRoleSwap) {
        updates.push(`role = $${i++}`);
        values.push(role);
      } else if (['administrator', 'finance'].includes(role) && ['administrator', 'finance'].includes(target.role)) {
        updates.push(`role = $${i++}`);
        values.push(role);
      } else if (role !== target.role) {
        return res.status(400).json({
          error: 'Role can only be changed between Administrator/Finance, or between Teacher and Headmaster when linked to a teacher profile',
        });
      }
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${i++}`);
      values.push(Boolean(isActive));
    }

    if (fullName !== undefined) {
      updates.push(`full_name = $${i++}`);
      values.push(String(fullName || '').trim() || null);
    }

    if (email !== undefined) {
      updates.push(`email = $${i++}`);
      values.push(String(email || '').trim() || null);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No valid user fields to update' });

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, tenantId);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i}
       RETURNING id, username, full_name, email, role, is_active, is_primary_admin`,
      values
    );

    const updated = result.rows[0];
    const userLabel = String(updated.full_name || updated.username || '').trim();
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE_USER',
      entityType: 'USER',
      entityId: parseInt(id, 10),
      module: 'settings',
      summary: withActor(`User account updated — ${userLabel}`, actor),
      details: { role: updated.role, isActive: updated.is_active, fullName: userLabel },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'user', 'updated');
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update school user error:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'Username or email already exists' });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Push diagnostics (primary admin or super-admin)
router.get('/push/stats', requireRole('super-admin', 'administrator', 'headmaster'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const parentsRes = await query(
      'SELECT COUNT(*)::int AS total FROM parent_portal_accounts WHERE tenant_id = $1',
      [tenantId]
    );
    const subscribedRes = await query(
      'SELECT COUNT(DISTINCT parent_account_id)::int AS total FROM parent_push_subscriptions WHERE tenant_id = $1',
      [tenantId]
    );
    const endpointsRes = await query(
      'SELECT COUNT(*)::int AS total FROM parent_push_subscriptions WHERE tenant_id = $1',
      [tenantId]
    );
    const fcmTokensRes = await query(
      'SELECT COUNT(*)::int AS total FROM parent_fcm_tokens WHERE tenant_id = $1',
      [tenantId]
    ).catch(() => ({ rows: [{ total: 0 }] as any[] }));

    const staffUsersRes = await query(
      `SELECT COUNT(*)::int AS total FROM users
       WHERE tenant_id = $1 AND role IN ('teacher', 'staff') AND is_active = true`,
      [tenantId]
    ).catch(() => ({ rows: [{ total: 0 }] as any[] }));
    const staffSubsUsersRes = await query(
      `SELECT COUNT(DISTINCT user_id)::int AS total FROM staff_user_push_subscriptions WHERE tenant_id = $1`,
      [tenantId]
    ).catch(() => ({ rows: [{ total: 0 }] as any[] }));
    const staffEndpointsRes = await query(
      'SELECT COUNT(*)::int AS total FROM staff_user_push_subscriptions WHERE tenant_id = $1',
      [tenantId]
    ).catch(() => ({ rows: [{ total: 0 }] as any[] }));

    return res.json({
      parentAccounts: Number(parentsRes.rows[0]?.total || 0),
      subscribedAccounts: Number(subscribedRes.rows[0]?.total || 0),
      totalEndpoints: Number(endpointsRes.rows[0]?.total || 0),
      fcmTokens: Number(fcmTokensRes.rows[0]?.total || 0),
      fcmConfigured: isFcmConfigured(),
      staffUserAccounts: Number(staffUsersRes.rows[0]?.total || 0),
      staffSubscribedUsers: Number(staffSubsUsersRes.rows[0]?.total || 0),
      staffPushEndpoints: Number(staffEndpointsRes.rows[0]?.total || 0),
    });
  } catch (error) {
    console.error('Get push stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch push stats' });
  }
});

// Send test push notification to parent portal devices (primary admin or super-admin)
router.post('/push/test', requireRole('super-admin', 'administrator', 'headmaster'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const title = String(req.body?.title || 'Parent Portal Test Notification').slice(0, 120);
    const body = String(
      req.body?.message || 'This is a test push from school admin. If you can see this, push works while app is closed.'
    ).slice(0, 300);

    const audience = String(req.body?.audience || 'all').toLowerCase();
    const pushPayloadParents = { title, body, url: `/portal/${tenantId}` as string };
    const pushPayloadStaff = { title, body, url: `/school/${tenantId}` as string };

    let stats: {
      parentAccounts?: number;
      subscribedAccounts?: number;
      staffUserAccounts?: number;
      subscribedUserAccounts?: number;
      subscribedDevices?: number;
    };
    let targetStudentIds: number[] | undefined;
    let targetClassId: number | undefined;

    if (audience === 'staff') {
      stats = await sendPushToTenantStaff(tenantId, pushPayloadStaff);
      try {
        const io = getIO();
        io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
          tenantId,
          entity: 'admin-staff-test-push',
          action: 'created',
          title,
          body,
          at: Date.now(),
          audience: 'staff',
        });
      } catch {
        /* ignore */
      }
    } else if (audience === 'students' || audience === 'student') {
      let ids: number[] = [];
      if (Array.isArray(req.body?.studentIds)) {
        ids = (req.body.studentIds as unknown[])
          .map((x) => parseInt(String(x), 10))
          .filter((n) => Number.isFinite(n) && n > 0);
      }
      if (ids.length === 0 && req.body?.studentId != null) {
        const one = parseInt(String(req.body.studentId), 10);
        if (Number.isFinite(one) && one > 0) ids = [one];
      }
      if (ids.length === 0) {
        return res.status(400).json({ error: 'studentIds is required (database student ids), at least one' });
      }
      try {
        stats = await sendPushToStudentsParents(tenantId, ids, pushPayloadParents);
      } catch (e: any) {
        if (e?.statusCode === 404) {
          return res.status(404).json({ error: e?.message || 'One or more students not found' });
        }
        throw e;
      }
      targetStudentIds = ids;
    } else if (audience === 'class') {
      const classId = parseInt(String(req.body?.classId), 10);
      if (!Number.isFinite(classId)) {
        return res.status(400).json({ error: 'classId is required when audience is class' });
      }
      try {
        stats = await sendPushToClassParents(tenantId, classId, pushPayloadParents);
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.message === 'Class not found') {
          return res.status(404).json({ error: 'Class not found' });
        }
        throw e;
      }
      targetClassId = classId;
    } else {
      stats = await sendPushToTenantParents(tenantId, pushPayloadParents);
    }

    // Realtime in-app banner for open parent sessions (filtered on client when targeted).
    if (audience !== 'staff') {
      try {
        const io = getIO();
        io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
          tenantId,
          entity: 'admin-test-push',
          action: 'created',
          title,
          body,
          at: Date.now(),
          audience: audience === 'class' ? 'class' : audience === 'students' || audience === 'student' ? 'students' : 'all',
          ...(targetStudentIds && targetStudentIds.length ? { targetStudentIds } : {}),
          ...(targetClassId != null ? { targetClassId } : {}),
        });
      } catch {
        // ignore realtime emit failures; web push path is primary
      }
    }

    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, details) VALUES ($1, $2, $3, $4, $5)',
      [
        tenantId,
        req.user!.id,
        'PUSH_TEST',
        'SETTINGS',
        JSON.stringify({
          title,
          audience:
            audience === 'staff'
              ? 'staff'
              : audience === 'class'
                ? 'class'
                : audience === 'students' || audience === 'student'
                  ? 'students'
                  : 'all',
          targetStudentIds,
          targetClassId,
          ...stats,
        }),
      ]
    ).catch(() => {});

    return res.json({
      success: true,
      message: 'Test push sent',
      audience:
        audience === 'staff'
          ? 'staff'
          : audience === 'class'
            ? 'class'
            : audience === 'students' || audience === 'student'
              ? 'students'
              : 'all',
      ...stats,
    });
  } catch (error) {
    console.error('Send test push error:', error);
    return res.status(500).json({ error: 'Failed to send test push' });
  }
});

// Sync Arrears for current tenant
router.post('/sync-arrears', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const { syncArrearsCarryForwardForTenant } = await import('../services/termActivationService.js');
    const result = await syncArrearsCarryForwardForTenant(tenantId);

    emitTenantDataChanged(tenantId, 'finance-arrears', 'updated');
    emitTenantDataChanged(tenantId, 'finance-term-switch', 'updated');
    res.json({ message: 'Arrears synchronized successfully', ...result });
  } catch (error: any) {
    console.error('Sync arrears error:', error);
    res.status(500).json({ error: error.message || 'Failed to synchronize arrears' });
  }
});

router.post('/reset-data', requirePrimaryAdminOrSuperAdmin, async (_req: AuthRequest, res) => {
  return res.status(403).json({ error: 'Data reset is managed from the Super Admin School Data page only.' });
});

// Appointment letter school-wide configuration
router.get('/appointment-letter', requireRole('super-admin', 'administrator', 'headmaster'), async (req: AuthRequest, res) => {
  try {
    const { getAppointmentLetterConfig } = await import('../services/appointmentLetterService.js');
    const config = await getAppointmentLetterConfig(req.user!.tenantId!);
    res.json(config);
  } catch (error) {
    console.error('Get appointment letter config error:', error);
    res.status(500).json({ error: 'Failed to load appointment letter settings' });
  }
});

router.put('/appointment-letter', requireRole('super-admin', 'administrator', 'headmaster'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { saveAppointmentLetterConfig } = await import('../services/appointmentLetterService.js');
    await saveAppointmentLetterConfig(tenantId, req.body || {});
    emitTenantDataChanged(tenantId, 'settings', 'updated');
    res.json({ success: true });
  } catch (error) {
    console.error('Save appointment letter config error:', error);
    res.status(500).json({ error: 'Failed to save appointment letter settings' });
  }
});

router.get('/admission-letter', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const { getAdmissionLetterConfig } = await import('../services/admissionLetterService.js');
    const config = await getAdmissionLetterConfig(req.user!.tenantId!);
    res.json(config);
  } catch (error) {
    console.error('Get admission letter config error:', error);
    res.status(500).json({ error: 'Failed to load admission letter settings' });
  }
});

router.put('/admission-letter', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { saveAdmissionLetterConfig } = await import('../services/admissionLetterService.js');
    await saveAdmissionLetterConfig(tenantId, req.body || {});
    emitTenantDataChanged(tenantId, 'settings', 'updated');
    res.json({ success: true });
  } catch (error) {
    console.error('Save admission letter config error:', error);
    res.status(500).json({ error: 'Failed to save admission letter settings' });
  }
});

const paymentSettingsRoles = requireRole('super-admin', 'administrator');

router.get('/payment', paymentSettingsRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await query(
      `SELECT mtn_momo_number, mtn_momo_name, vodafone_cash_number, vodafone_cash_name,
              airteltigo_number, airteltigo_name, merchant_id,
              bank_name, bank_account_number, bank_account_name, payment_instructions
       FROM school_payment_settings
       WHERE tenant_id = $1`,
      [tenantId]
    );
    const row = result.rows[0] || {};
    res.json({
      mtnMomoNumber: row.mtn_momo_number || '',
      mtnMomoName: row.mtn_momo_name || '',
      vodafoneCashNumber: row.vodafone_cash_number || '',
      vodafoneCashName: row.vodafone_cash_name || '',
      airteltigoNumber: row.airteltigo_number || '',
      airteltigoName: row.airteltigo_name || '',
      merchantId: row.merchant_id || '',
      bankName: row.bank_name || '',
      bankAccountNumber: row.bank_account_number || '',
      bankAccountName: row.bank_account_name || '',
      paymentInstructions: row.payment_instructions || '',
    });
  } catch (error) {
    console.error('Get payment settings error:', error);
    res.status(500).json({ error: 'Failed to load payment settings' });
  }
});

router.put('/payment', paymentSettingsRoles, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const b = req.body || {};
    await query(
      `INSERT INTO school_payment_settings (
         tenant_id, mtn_momo_number, mtn_momo_name, vodafone_cash_number, vodafone_cash_name,
         airteltigo_number, airteltigo_name, merchant_id,
         bank_name, bank_account_number, bank_account_name, payment_instructions, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET
         mtn_momo_number = EXCLUDED.mtn_momo_number,
         mtn_momo_name = EXCLUDED.mtn_momo_name,
         vodafone_cash_number = EXCLUDED.vodafone_cash_number,
         vodafone_cash_name = EXCLUDED.vodafone_cash_name,
         airteltigo_number = EXCLUDED.airteltigo_number,
         airteltigo_name = EXCLUDED.airteltigo_name,
         merchant_id = EXCLUDED.merchant_id,
         bank_name = EXCLUDED.bank_name,
         bank_account_number = EXCLUDED.bank_account_number,
         bank_account_name = EXCLUDED.bank_account_name,
         payment_instructions = EXCLUDED.payment_instructions,
         updated_at = NOW()`,
      [
        tenantId,
        String(b.mtnMomoNumber || '').trim() || null,
        String(b.mtnMomoName || '').trim() || null,
        String(b.vodafoneCashNumber || '').trim() || null,
        String(b.vodafoneCashName || '').trim() || null,
        String(b.airteltigoNumber || '').trim() || null,
        String(b.airteltigoName || '').trim() || null,
        String(b.merchantId || '').trim() || null,
        String(b.bankName || '').trim() || null,
        String(b.bankAccountNumber || '').trim() || null,
        String(b.bankAccountName || '').trim() || null,
        String(b.paymentInstructions || '').trim() || null,
      ]
    );
    emitTenantDataChanged(tenantId, 'settings', 'updated');
    res.json({ success: true });
  } catch (error) {
    console.error('Save payment settings error:', error);
    res.status(500).json({ error: 'Failed to save payment settings' });
  }
});

export default router;
