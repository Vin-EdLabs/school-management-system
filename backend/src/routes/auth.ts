import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getVapidPublicKey } from '../services/webPushService.js';

const router = express.Router();

const normalizeRole = (role: string | null | undefined): string => {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'superadmin') return 'super-admin';
  if (r === 'admin') return 'administrator';
  return r;
};

// Login - tenant-aware, blocks inactive schools
router.post('/login', async (req, res) => {
  try {
    const { username, password, tenantId: rawTenantId } = req.body;
    const tenantId = rawTenantId !== undefined && rawTenantId !== null && rawTenantId !== ''
      ? parseInt(String(rawTenantId), 10) : null;
    const hasTenantId = tenantId !== null && !isNaN(tenantId);
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    if (hasTenantId) {
      const tenantCheck = await query(
        'SELECT id, is_active FROM tenants WHERE id = $1',
        [tenantId]
      );
      if (tenantCheck.rows.length === 0) {
        return res.status(404).json({ error: 'School not found' });
      }
      if (!tenantCheck.rows[0].is_active) {
        return res.status(403).json({ error: 'School account is suspended' });
      }
    }
    
    // Try modern schema first, then progressively simpler legacy-compatible queries.
    const attempts: Array<{ sql: string; params: any[] }> = [
      {
        sql: `
          SELECT u.id, u.tenant_id, u.username, u.password_hash, u.role, u.teacher_id, u.other_staff_id, u.is_primary_admin,
                 COALESCE(t.full_name, s.full_name, u.username) as full_name
          FROM users u
          LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
          LEFT JOIN payroll_other_staff s ON u.other_staff_id = s.id AND s.tenant_id = u.tenant_id
          WHERE (u.username = $1 OR u.email = $1) AND u.is_active = true
          ${hasTenantId ? 'AND (u.tenant_id = $2 OR u.tenant_id IS NULL)' : 'AND u.tenant_id IS NULL'}
        `,
        params: hasTenantId ? [username, tenantId] : [username]
      },
      {
        sql: `
          SELECT u.id, u.tenant_id, u.username, u.password_hash, u.role, u.teacher_id, u.other_staff_id, u.is_primary_admin,
                 u.username as full_name
          FROM users u
          WHERE u.username = $1
          ${hasTenantId ? 'AND (u.tenant_id = $2 OR u.tenant_id IS NULL)' : ''}
        `,
        params: hasTenantId ? [username, tenantId] : [username]
      },
      {
        sql: `
          SELECT u.id, NULL::integer as tenant_id, u.username, u.password_hash, u.role,
                 NULL::text as teacher_id, false as is_primary_admin, u.username as full_name
          FROM users u
          WHERE u.username = $1
        `,
        params: [username]
      }
    ];

    let result: any = { rows: [] };
    for (const attempt of attempts) {
      try {
        result = await query(attempt.sql, attempt.params);
        if (result.rows.length > 0) break;
      } catch {
        continue;
      }
    }
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: normalizeRole(user.role) },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    // Log login
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, ip_address, user_agent, details) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        user.tenant_id,
        user.id,
        'LOGIN',
        'USER',
        req.ip || null,
        req.get('user-agent') || null,
        JSON.stringify({ username: user.username, role: normalizeRole(user.role) }),
      ]
    ).catch(() => { });
    
    const userRow = result.rows[0];
    const isPrimaryAdmin = userRow.is_primary_admin === true;
    res.json({
      token,
        user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: normalizeRole(user.role),
        tenantId: user.tenant_id,
        teacherId: user.teacher_id,
        otherStaffId: user.other_staff_id ?? null,
        isPrimaryAdmin,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify password (for sensitive operations)
router.post('/verify-password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });
    res.json({ valid: true });
  } catch {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Change password
router.post('/change-password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }
    
    const minLength = req.user!.role === 'teacher' || req.user!.role === 'staff' ? 5 : 6;
    if (newPassword.length < minLength) {
      return res.status(400).json({ error: `Password must be at least ${minLength} characters` });
    }
    
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash
    );
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.user!.id]
    );
    
    // Log password change
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type) VALUES ($1, $2, $3, $4)',
      [req.user!.tenantId, req.user!.id, 'PASSWORD_CHANGE', 'USER']
    );
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Logout - logs LOGOUT for audit
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, ip_address, user_agent, details) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        req.user!.tenantId,
        req.user!.id,
        'LOGOUT',
        'USER',
        req.ip || null,
        req.get('user-agent') || null,
        JSON.stringify({ username: req.user!.username }),
      ]
    );
    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout audit error:', error);
    res.json({ message: 'Logged out' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.role, u.tenant_id, u.teacher_id, u.other_staff_id, u.is_primary_admin,
              COALESCE(t.full_name, s.full_name, u.username) as full_name
       FROM users u
       LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
       LEFT JOIN payroll_other_staff s ON u.other_staff_id = s.id AND s.tenant_id = u.tenant_id
       WHERE u.id = $1`,
      [req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    // If user has tenant, get tenant info
    let tenant = null;
    if (user.tenant_id) {
      const tenantResult = await query('SELECT id, name FROM tenants WHERE id = $1', [user.tenant_id]);
      if (tenantResult.rows.length > 0) {
        tenant = tenantResult.rows[0];
      }
    }
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: normalizeRole(user.role),
        tenantId: user.tenant_id,
        teacherId: user.teacher_id,
        otherStaffId: user.other_staff_id ?? null,
        isPrimaryAdmin: user.is_primary_admin === true,
        tenant,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Web push for teacher/staff school app (same VAPID keys as parent portal)
router.get('/push/public-key', authenticate, async (req: AuthRequest, res) => {
  const role = normalizeRole(req.user!.role);
  if (role !== 'teacher' && role !== 'staff') {
    return res.status(403).json({ error: 'Only teacher or staff accounts can use school push' });
  }
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({ error: 'Push notifications are not configured yet' });
  }
  return res.json({ publicKey });
});

router.post('/push/subscribe', authenticate, async (req: AuthRequest, res) => {
  try {
    const role = normalizeRole(req.user!.role);
    if (role !== 'teacher' && role !== 'staff') {
      return res.status(403).json({ error: 'Only teacher or staff accounts can subscribe' });
    }
    const tenantId = req.user!.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'School context required' });

    const { endpoint, keys } = req.body || {};
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Invalid push subscription payload' });
    }

    await query(
      `INSERT INTO staff_user_push_subscriptions (tenant_id, user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, endpoint)
       DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [tenantId, req.user!.id, endpoint, p256dh, auth]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Staff push subscribe error:', error);
    return res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

router.post('/push/unsubscribe', authenticate, async (req: AuthRequest, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });
    await query('DELETE FROM staff_user_push_subscriptions WHERE user_id = $1 AND endpoint = $2', [
      req.user!.id,
      endpoint,
    ]);
    return res.json({ success: true });
  } catch (error) {
    console.error('Staff push unsubscribe error:', error);
    return res.status(500).json({ error: 'Failed to remove push subscription' });
  }
});

export default router;
