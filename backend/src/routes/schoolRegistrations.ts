import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Public: Submit registration request (no auth)
router.post('/', async (req, res) => {
  try {
    const { schoolName, adminName, email, phone, message } = req.body;

    if (!schoolName || !adminName || !email) {
      return res.status(400).json({ error: 'School name, admin name, and email are required' });
    }

    const result = await query(
      `INSERT INTO school_registrations (school_name, admin_name, email, phone, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, school_name, admin_name, email, phone, message, status, created_at`,
      [schoolName, adminName, email, phone || null, message || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Submit registration error:', error);
    res.status(500).json({ error: 'Failed to submit registration' });
  }
});

// Super-admin: List all registration requests
router.get('/', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT r.*, t.slug as school_slug 
       FROM school_registrations r
       LEFT JOIN tenants t ON r.tenant_id = t.id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List registrations error:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Super-admin: Update registration status
router.patch('/:id/status', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  const client = await (await import('../db/connection.js')).getClient();
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'contacted', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await client.query('BEGIN');

    // Fetch the registration details
    const regCheck = await client.query('SELECT * FROM school_registrations WHERE id = $1', [id]);
    if (regCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Registration not found' });
    }

    const registration = regCheck.rows[0];

    // If approving and not already approved/created
    if (status === 'approved' && !registration.tenant_id) {
      const { school_name, admin_name, email } = registration;
      
      // Default credentials
      const adminUsername = 'admin';
      const defaultPassword = 'password123'; // Simple default, can be changed later
      const slug = school_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash(defaultPassword, 10);

      // 1. Create tenant
      const tenantResult = await client.query(
        `INSERT INTO tenants (name, slug, subdomain, subscription_status, is_active)
         VALUES ($1, $2, $3, 'active', true) RETURNING id`,
        [school_name, slug, slug]
      );
      const tenantId = tenantResult.rows[0].id;

      // 2. Create primary admin user
      await client.query(
        'INSERT INTO users (tenant_id, username, email, full_name, password_hash, role, is_primary_admin) VALUES ($1, $2, $3, $4, $5, $6, true)',
        [tenantId, adminUsername, email, admin_name, hashedPassword, 'administrator']
      );

      // 3. Create default settings
      await client.query(
        'INSERT INTO school_settings (tenant_id, school_name, email) VALUES ($1, $2, $3)',
        [tenantId, school_name, email]
      );

      // 4. Update registration with created tenant and password
      const result = await client.query(
        `UPDATE school_registrations SET status = $1, tenant_id = $2, generated_password = $3 WHERE id = $4 RETURNING *`,
        [status, tenantId, defaultPassword, id]
      );

      await client.query('COMMIT');
      return res.json(result.rows[0]);
    }

    // Standard status update if not approving or already created
    const result = await client.query(
      `UPDATE school_registrations SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update registration status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  } finally {
    client.release();
  }
});

// Super-admin: Update internal note
router.patch('/:id/note', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { internalNote } = req.body;

    const result = await query(
      `UPDATE school_registrations SET internal_note = $1 WHERE id = $2 RETURNING id, internal_note`,
      [internalNote || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update registration note error:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Super-admin: Delete registration request
router.delete('/:id', authenticate, requireRole('super-admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM school_registrations WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    
    res.json({ message: 'Registration deleted successfully' });
  } catch (error) {
    console.error('Delete registration error:', error);
    res.status(500).json({ error: 'Failed to delete registration' });
  }
});

export default router;
