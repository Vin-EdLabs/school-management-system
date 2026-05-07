import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../db/connection.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { getIO } from '../socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

const router = express.Router();

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
      `SELECT id, name, slug, subdomain, logo_url, primary_color, secondary_color,
              subscription_status, is_active, created_at, updated_at
       FROM tenants ORDER BY created_at DESC`
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
              subscription_status, is_active, created_at, updated_at
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
    
    const slugVal = slug || subdomain || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const client = await (await import('../db/connection.js')).getClient();
    
    try {
      await client.query('BEGIN');
      
      const tenantResult = await client.query(
        `INSERT INTO tenants (name, slug, subdomain, primary_color, secondary_color, subscription_status, is_active)
         VALUES ($1, $2, $3, $4, $5, 'active', true) RETURNING id`,
        [name, slugVal, subdomain || slugVal || null, primary_color || null, secondary_color || null]
      );
      
      const tenantId = tenantResult.rows[0].id;
      
      // Create admin user (first admin = primary for this school)
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await client.query(
        'INSERT INTO users (tenant_id, username, email, password_hash, role, is_primary_admin) VALUES ($1, $2, $3, $4, $5, true)',
        [tenantId, adminUsername, adminEmail || null, hashedPassword, 'administrator']
      );
      
      // Create default school settings
      await client.query(
        'INSERT INTO school_settings (tenant_id, school_name) VALUES ($1, $2)',
        [tenantId, name]
      );
      
      await client.query('COMMIT');
      
      // Log creation
      await query(
        'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES (NULL, $1, $2, $3, $4)',
        [req.user!.id, 'CREATE', 'TENANT', tenantId]
      );
      emitSystemDataChanged('school', 'created', tenantId);
      
      res.status(201).json({
        id: tenantId,
        name,
        slug: slugVal,
        subdomain: subdomain || slugVal,
        message: 'School created successfully',
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
        return res.status(409).json({ error: 'School name or subdomain already exists' });
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create school error:', error);
    res.status(500).json({ error: 'Failed to create school' });
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
    res.json({ logoUrl: base64Image });
  } catch (error) {
    console.error('Upload school logo error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// Update school
router.put('/:id', requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, slug, subdomain, logo_url, primary_color, secondary_color, subscription_status, is_active } = req.body;
    
    const result = await query(
      `UPDATE tenants SET 
        name = COALESCE($1, name), slug = COALESCE($2, slug), subdomain = COALESCE($3, subdomain),
        logo_url = COALESCE($4, logo_url), primary_color = COALESCE($5, primary_color),
        secondary_color = COALESCE($6, secondary_color),
        subscription_status = COALESCE($7, subscription_status),
        is_active = COALESCE($8, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING *`,
      [name, slug, subdomain, logo_url, primary_color, secondary_color, subscription_status, is_active, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    // Log update
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES (NULL, $1, $2, $3, $4)',
      [req.user!.id, 'UPDATE', 'TENANT', parseInt(id)]
    );
    emitSystemDataChanged('school', 'updated', parseInt(id));
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update school error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'School name or subdomain already exists' });
    }
    res.status(500).json({ error: 'Failed to update school' });
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

export default router;
