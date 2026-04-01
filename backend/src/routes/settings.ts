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

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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
      receipt_prefix, postal_address, contact_phone, receipt_footer, bank_details } = req.body;
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
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $12
       RETURNING *`,
      [school_name, address, contact, email, current_year, current_term, receipt_prefix, postal_address, contact_phone, receipt_footer, bank_details, tenantId]
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
        'INSERT INTO school_settings (tenant_id, school_name, address, contact, email, current_year, current_term) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [tenantId, school_name || 'School', address, contact, email, current_year, current_term]
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
    const logoUrl = `/uploads/${req.file.filename}`;
    
    // Get current logo to delete old one
    const currentResult = await query(
      'SELECT logo_url FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    
    if (currentResult.rows.length > 0 && currentResult.rows[0].logo_url) {
      const oldLogoPath = path.join(__dirname, '../../', currentResult.rows[0].logo_url);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }
    
    // Update logo URL in school_settings and tenants for consistent branding
    await query(
      'UPDATE school_settings SET logo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2',
      [logoUrl, tenantId]
    );
    await query(
      'UPDATE tenants SET logo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [logoUrl, tenantId]
    );
    
    // Log update
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type) VALUES ($1, $2, $3, $4)',
      [tenantId, req.user!.id, 'UPDATE', 'SETTINGS']
    );
    
    res.json({ logoUrl });
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
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update academic term error:', error);
    res.status(500).json({ error: 'Failed to update academic term' });
  }
});

// Delete academic term (primary admin or super-admin)
router.delete('/academic-terms/:id', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM academic_terms WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Academic term not found' });
    }
    
    // Log deletion
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'DELETE', 'ACADEMIC_TERM', parseInt(id)]
    );
    
    res.json({ message: 'Academic term deleted successfully' });
  } catch (error) {
    console.error('Delete academic term error:', error);
    res.status(500).json({ error: 'Failed to delete academic term' });
  }
});

// Get school users - all staff with names (primary admin or super-admin)
router.get('/users', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required' });

    const result = await query(
      `SELECT u.id, u.username, u.email, u.role, u.teacher_id, u.other_staff_id, u.is_active, u.is_primary_admin, u.created_at,
        COALESCE(t.full_name, s.full_name, u.username) as full_name,
        COALESCE(t.staff_id, s.staff_id) as staff_id
       FROM users u
       LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
       LEFT JOIN payroll_other_staff s ON u.other_staff_id = s.id AND s.tenant_id = u.tenant_id
       WHERE u.tenant_id = $1
       ORDER BY 
         CASE u.role WHEN 'super-admin' THEN 0 WHEN 'administrator' THEN 1 WHEN 'finance' THEN 2 WHEN 'teacher' THEN 3 WHEN 'staff' THEN 4 ELSE 5 END,
         COALESCE(t.full_name, s.full_name, u.username)`,
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

    const { username, password, email, role, teacherId } = req.body;
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

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (tenant_id, username, email, password_hash, role, teacher_id, other_staff_id, is_primary_admin) VALUES ($1, $2, $3, $4, $5, $6, $7, false) RETURNING id, username, email, role',
      [tenantId, username, email || null, hashedPassword, role, teacherId || null, req.body.otherStaffId || null]
    );

    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'CREATE', 'USER', result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Create school user error:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Reset all school data (Primary Admin only + Password verification)
router.post('/reset-data', requirePrimaryAdminOrSuperAdmin, async (req: AuthRequest, res) => {
  const client = await query('BEGIN'); // Start transaction manually via pool won't work easily if we don't have the client
  // Better to use getClient() if possible, but let's use the query helper for simple sequential deletes
  
  try {
    const tenantId = req.user!.tenantId!;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to confirm data reset' });
    }

    // Verify password
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    const isMatch = await bcrypt.compare(password, userResult.rows[0].password_hash);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Reset aborted.' });
    }

    console.warn(`[RESET] Triggering full data reset for tenant ${tenantId} requested by user ${req.user!.id}`);

    // List of tables to clear (tenant-scoped)
    const tables = [
      'attendance', 'student_grades', 'grade_audit_log', 'grade_assignments',
      'receipts', 'payments', 'student_credits', 'income', 'expenses',
      'student_ledger', 'ledger_fee_structures', 'term_outstanding_balances',
      'student_arrears', 'student_arrears_balance', 'term_arrears',
      'salary_payments', 'payroll_other_staff', 'class_teachers', 'students',
      'classes', 'subjects', 'support_messages', 'term_report_releases',
      'parent_portal_accounts', 'receipt_number_seq', 'terms', 'academic_years',
      'academic_terms', 'events'
    ];

    // Delete in sequence to respect foreign key constraints (though usually CASCADE is set, this is safer)
    for (const table of tables) {
      await query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]);
    }

    // Reset school settings back to defaults
    await query(`
      UPDATE school_settings 
      SET address = NULL, contact = NULL, email = NULL, 
          current_year = $2, current_term = NULL,
          receipt_prefix = 'R', postal_address = NULL, 
          contact_phone = NULL, receipt_footer = NULL, 
          bank_details = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1`, 
      [tenantId, new Date().getFullYear().toString()]
    );

    // Final audit log
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, details) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'FULL_RESET', 'TENANT_DATA', JSON.stringify({ timestamp: new Date() })]
    );

    res.json({ message: 'All school data has been permanently deleted and settings reset.' });
  } catch (error) {
    console.error('Reset data error:', error);
    res.status(500).json({ error: 'Failed to reset data. Please contact support.' });
  }
});

export default router;
