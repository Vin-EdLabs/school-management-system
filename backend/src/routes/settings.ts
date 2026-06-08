import express from 'express';
import multer from 'multer';
import { compressLogoForStorage } from '../services/logoImageService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { query } from '../db/connection.js';
import bcrypt from 'bcryptjs';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole, requirePrimaryAdminOrSuperAdmin } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { resolveLedgerTermFromSettings, postFeesForNewTerm, postFeesForNewTermWithArrears } from '../services/ledgerFinanceService.js';
import { getIO } from '../socket.js';
import {
  sendPushToTenantParents,
  sendPushToStudentsParents,
  sendPushToClassParents,
  sendPushToTenantStaff,
} from '../services/webPushService.js';
import { isFcmConfigured } from '../services/fcmService.js';

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
      await query(
        'INSERT INTO school_settings (tenant_id, school_name) VALUES ($1, $2)',
        [tenantId, 'School']
      );
      
      const newResult = await query(
        'SELECT * FROM school_settings WHERE tenant_id = $1',
        [tenantId]
      );
      return res.json(newResult.rows[0]);
    }
    
    res.json(result.rows[0]);
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
    
    // Log update
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type) VALUES ($1, $2, $3, $4)',
      [tenantId, req.user!.id, 'UPDATE', 'SETTINGS']
    );

    const saved = result.rows[0];
    const newYear = saved?.current_year ?? current_year;
    const newTerm = saved?.current_term ?? current_term;
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
    const base64Image = await compressLogoForStorage(req.file.buffer, req.file.mimetype);

    // Update logo URL in school_settings and tenants for consistent branding
    await query(
      'UPDATE school_settings SET logo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2',
      [base64Image, tenantId]
    );
    await query(
      'UPDATE tenants SET logo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [base64Image, tenantId]
    );
    
    // Log update
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type) VALUES ($1, $2, $3, $4)',
      [tenantId, req.user!.id, 'UPDATE', 'SETTINGS']
    );
    emitTenantDataChanged(tenantId, 'settings', 'updated');
    res.json({ logoUrl: base64Image });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// Get academic terms
router.get('/academic-terms', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    
    const result = await query(
      'SELECT * FROM academic_terms WHERE tenant_id = $1 ORDER BY year DESC, start_date DESC',
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
    
    // Log creation
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'CREATE', 'ACADEMIC_TERM', result.rows[0].id]
    );
    emitTenantDataChanged(tenantId, 'academic-term', 'created');
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
    const { term_name, year, start_date, end_date, is_active } = req.body;
    
    // If setting as active, deactivate others
    if (is_active) {
      await query(
        'UPDATE academic_terms SET is_active = false WHERE tenant_id = $1 AND id != $2',
        [tenantId, id]
      );
    }
    
    const result = await query(
      `UPDATE academic_terms 
       SET term_name = COALESCE($1, term_name),
           year = COALESCE($2, year),
           start_date = COALESCE($3, start_date),
           end_date = COALESCE($4, end_date),
           is_active = COALESCE($5, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND tenant_id = $7
       RETURNING *`,
      [term_name, year, start_date, end_date, is_active, id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Academic term not found' });
    }
    
    // Log update
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'UPDATE', 'ACADEMIC_TERM', parseInt(id)]
    );
    emitTenantDataChanged(tenantId, 'academic-term', 'updated');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update academic term error:', error);
    res.status(500).json({ error: 'Failed to update academic term' });
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

    const result = await query(
      `SELECT u.id, u.username, COALESCE(u.email, t.email) as email, u.role, u.teacher_id, u.other_staff_id, u.is_active, u.is_primary_admin, u.created_at,
        COALESCE(t.full_name, s.full_name, u.full_name, u.username) as full_name,
        COALESCE(t.staff_id, s.staff_id) as staff_id
       FROM users u
       LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
       LEFT JOIN payroll_other_staff s ON u.other_staff_id = s.id AND s.tenant_id = u.tenant_id
       WHERE u.tenant_id = $1
       ORDER BY 
         CASE u.role WHEN 'super-admin' THEN 0 WHEN 'administrator' THEN 1 WHEN 'finance' THEN 2 WHEN 'teacher' THEN 3 WHEN 'staff' THEN 4 ELSE 5 END,
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
    const userCheck = await query(
      'SELECT id, role FROM users WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User teacher not found' });
    }
    
    const targetRole = userCheck.rows[0].role;
    const minLength = targetRole === 'teacher' || targetRole === 'staff' ? 5 : 6;

    if (!newPassword || newPassword.length < minLength) {
      return res.status(400).json({ error: `New password must be at least ${minLength} characters` });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashed, id]
    );
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'RESET_PASSWORD', 'USER', parseInt(id)]
    );
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
    if (!['administrator', 'finance', 'teacher', 'staff'].includes(role)) {
      return res.status(400).json({ error: 'Role must be administrator, finance, teacher, or staff' });
    }
    const minLength = role === 'teacher' || role === 'staff' ? 5 : 6;
    if (password.length < minLength) {
      return res.status(400).json({ error: `Password must be at least ${minLength} characters` });
    }
    if ((role === 'administrator' || role === 'finance') && !String(fullName || '').trim()) {
      return res.status(400).json({ error: 'Full name is required for Administrator and Finance users' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (tenant_id, username, full_name, email, password_hash, role, teacher_id, other_staff_id, is_primary_admin) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) RETURNING id, username, full_name, email, role, is_active, is_primary_admin',
      [tenantId, username, String(fullName || '').trim() || null, email || null, hashedPassword, role, teacherId || null, req.body.otherStaffId || null]
    );

    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'CREATE', 'USER', result.rows[0].id]
    );
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
      'SELECT id, role, is_primary_admin FROM users WHERE id = $1 AND tenant_id = $2',
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
      if (!['administrator', 'finance'].includes(role)) {
        return res.status(400).json({ error: 'Only Administrator and Finance roles can be changed here' });
      }
      if (!['administrator', 'finance'].includes(target.role)) {
        return res.status(400).json({ error: 'Only Administrator and Finance users can have their role changed' });
      }
      updates.push(`role = $${i++}`);
      values.push(role);
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

    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [tenantId, req.user!.id, 'UPDATE_USER', 'USER', parseInt(id), JSON.stringify({ role, isActive })]
    ).catch(() => {});
    emitTenantDataChanged(tenantId, 'user', 'updated');
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update school user error:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'Username or email already exists' });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Push diagnostics (primary admin or super-admin)
router.get('/push/stats', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
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
router.post('/push/test', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
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

    const { refreshArrearsForTenant } = await import('../services/arrearsService.js');
    const result = await refreshArrearsForTenant(tenantId);
    
    emitTenantDataChanged(tenantId, 'finance-arrears', 'updated');
    res.json({ message: 'Arrears synchronized successfully', ...result });
  } catch (error: any) {
    console.error('Sync arrears error:', error);
    res.status(500).json({ error: error.message || 'Failed to synchronize arrears' });
  }
});

router.post('/reset-data', requirePrimaryAdminOrSuperAdmin, async (_req: AuthRequest, res) => {
  return res.status(403).json({ error: 'Data reset is managed from the Super Admin School Data page only.' });
});

export default router;
