import express from 'express';
import { getClient, query } from '../db/connection.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { getIO } from '../socket.js';
import { allocateUniqueTenantSlug } from '../services/tenantSlugService.js';

const router = express.Router();

async function ensureRegistrationSchema(client: Awaited<ReturnType<typeof getClient>>) {
  await client.query(`ALTER TABLE school_registrations ADD COLUMN IF NOT EXISTS internal_note TEXT`).catch(() => undefined);
  await client.query(`ALTER TABLE school_registrations ADD COLUMN IF NOT EXISTS tenant_id INTEGER`).catch(() => undefined);
  await client.query(`ALTER TABLE school_registrations ADD COLUMN IF NOT EXISTS generated_password VARCHAR(255)`).catch(() => undefined);
  await client.query(`ALTER TABLE school_registrations ADD COLUMN IF NOT EXISTS generated_username VARCHAR(100)`).catch(() => undefined);
  await client.query(`ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS email VARCHAR(255)`).catch(() => undefined);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER`).catch(() => undefined);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)`).catch(() => undefined);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)`).catch(() => undefined);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_primary_admin BOOLEAN DEFAULT false`).catch(() => undefined);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`).catch(() => undefined);
}

async function uniqueTenantSlug(client: Awaited<ReturnType<typeof getClient>>, schoolName: string) {
  return allocateUniqueTenantSlug(client, schoolName);
}

async function uniqueAdminUsername(client: Awaited<ReturnType<typeof getClient>>, slug: string) {
  const base = `${slug.replace(/-+/g, '_')}_admin`.slice(0, 80) || 'school_admin';
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await client.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [candidate]);
    if (existing.rows.length === 0) return candidate;
    candidate = `${base}_${suffix}`.slice(0, 100);
    suffix += 1;
  }
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

    emitSystemDataChanged('school-registration', 'created');
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
  const client = await getClient();
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'contacted', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await ensureRegistrationSchema(client);
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
      
      const slug = await uniqueTenantSlug(client, school_name);
      const adminUsername = await uniqueAdminUsername(client, slug);
      const defaultPassword = 'password123'; // Simple default, can be changed later
      
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash(defaultPassword, 10);

      // 1. Create tenant
      const tenantResult = await client.query(
        `INSERT INTO tenants (name, slug, subdomain, subscription_status, is_active)
         VALUES ($1, $2, $3, 'active', true) RETURNING id`,
        [school_name, slug, slug]
      );
      const tenantId = tenantResult.rows[0].id;

      // 2. Create primary admin user (support both modern and legacy users schemas)
      let createdUser = false;
      const userInsertAttempts: Array<{ sql: string; params: any[] }> = [
        {
          sql: 'INSERT INTO users (tenant_id, username, email, full_name, password_hash, role, is_primary_admin) VALUES ($1, $2, $3, $4, $5, $6, true)',
          params: [tenantId, adminUsername, email, admin_name, hashedPassword, 'administrator'],
        },
        {
          sql: 'INSERT INTO users (tenant_id, username, email, password_hash, role, is_primary_admin) VALUES ($1, $2, $3, $4, $5, true)',
          params: [tenantId, adminUsername, email, hashedPassword, 'administrator'],
        },
        {
          sql: 'INSERT INTO users (tenant_id, username, password_hash, role) VALUES ($1, $2, $3, $4)',
          params: [tenantId, adminUsername, hashedPassword, 'administrator'],
        },
        {
          sql: 'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
          params: [adminUsername, hashedPassword, 'administrator'],
        },
      ];
      for (const attempt of userInsertAttempts) {
        try {
          await client.query(attempt.sql, attempt.params);
          createdUser = true;
          break;
        } catch {
          continue;
        }
      }
      if (!createdUser) {
        throw new Error('Failed to create school admin user with available schema');
      }

      // 3. Create default settings
      await client.query(
        'INSERT INTO school_settings (tenant_id, school_name, email) VALUES ($1, $2, $3) ON CONFLICT (tenant_id) DO NOTHING',
        [tenantId, school_name, email]
      );

      await client.query(
        `INSERT INTO school_setup_progress (school_id) VALUES ($1) ON CONFLICT (school_id) DO NOTHING`,
        [tenantId]
      );

      // 4. Update registration with created tenant and password
      const result = await client.query(
        `UPDATE school_registrations SET status = $1, tenant_id = $2, generated_password = $3, generated_username = $4 WHERE id = $5 RETURNING *`,
        [status, tenantId, defaultPassword, adminUsername, id]
      );

      await client.query('COMMIT');
      emitSystemDataChanged('school-registration', 'updated', tenantId);
      return res.json(result.rows[0]);
    }

    // Standard status update if not approving or already created
    const result = await client.query(
      `UPDATE school_registrations SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    await client.query('COMMIT');
    emitSystemDataChanged('school-registration', 'updated', registration.tenant_id || undefined);
    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Update registration status error:', error);
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'A school with these access details already exists. Try approving again or create the school manually.' });
    }
    res.status(500).json({ error: error?.message || 'Failed to update status' });
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

    emitSystemDataChanged('school-registration', 'updated');
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
    
    emitSystemDataChanged('school-registration', 'deleted');
    res.json({ message: 'Registration deleted successfully' });
  } catch (error) {
    console.error('Delete registration error:', error);
    res.status(500).json({ error: 'Failed to delete registration' });
  }
});

export default router;
