import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getVapidPublicKey } from '../services/webPushService.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import { resolveUserDisplayName } from '../utils/auditResolve.js';
import { pulseHttpSession, clearHttpSession } from '../services/presenceService.js';
import { getIO } from '../socket.js';

const router = express.Router();

const normalizeRole = (role: string | null | undefined): string => {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'superadmin') return 'super-admin';
  if (r === 'admin') return 'administrator';
  return r;
};

const isSuperAdminUser = (role: string | null | undefined, tenantId: number | null | undefined) =>
  normalizeRole(role) === 'super-admin' && (tenantId == null || Number.isNaN(Number(tenantId)));

const nextDayLockSql = `
  date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + interval '1 day'
`;

// Login - tenant-aware, blocks inactive schools
router.post('/login', async (req, res) => {
  try {
    const { username, password, tenantId: rawTenantId, role: requestedRole } = req.body;
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
                 COALESCE(t.full_name, s.full_name, u.full_name, u.username) as full_name
          FROM users u
          LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
          LEFT JOIN other_staff s ON u.other_staff_id = s.id AND s.tenant_id = u.tenant_id
          WHERE (u.username = $1 OR u.email = $1 OR t.staff_id = $1 OR s.staff_id = $1) AND u.is_active = true
          ${hasTenantId ? 'AND (u.tenant_id = $2 OR u.tenant_id IS NULL)' : 'AND u.tenant_id IS NULL'}
        `,
        params: hasTenantId ? [username, tenantId] : [username]
      },
      {
        sql: `
          SELECT u.id, u.tenant_id, u.username, u.password_hash, u.role, u.teacher_id, u.other_staff_id, u.is_primary_admin,
                 u.username as full_name
          FROM users u
          WHERE u.username = $1 AND COALESCE(u.is_active, true) = true
          ${hasTenantId ? 'AND (u.tenant_id = $2 OR u.tenant_id IS NULL)' : ''}
        `,
        params: hasTenantId ? [username, tenantId] : [username]
      },
      {
        sql: `
          SELECT u.id, NULL::integer as tenant_id, u.username, u.password_hash, u.role,
                 NULL::text as teacher_id, false as is_primary_admin, u.username as full_name
          FROM users u
          WHERE u.username = $1 AND COALESCE(u.is_active, true) = true
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
      const inactiveAttempts: Array<{ sql: string; params: any[] }> = [
        {
          sql: `
            SELECT u.id, u.tenant_id, u.username, u.role
            FROM users u
            WHERE (u.username = $1 OR u.email = $1 OR EXISTS (
              SELECT 1 FROM teachers t2 WHERE t2.tenant_id = u.tenant_id AND t2.staff_id = $1 AND u.teacher_id::text = t2.id::text
            )) AND COALESCE(u.is_active, true) = false
            ${hasTenantId ? 'AND (u.tenant_id = $2 OR u.tenant_id IS NULL)' : 'AND u.tenant_id IS NULL'}
            LIMIT 1
          `,
          params: hasTenantId ? [username, tenantId] : [username],
        },
        {
          sql: `
            SELECT u.id, u.tenant_id, u.username, u.role
            FROM users u
            WHERE u.username = $1 AND COALESCE(u.is_active, true) = false
            ${hasTenantId ? 'AND (u.tenant_id = $2 OR u.tenant_id IS NULL)' : ''}
            LIMIT 1
          `,
          params: hasTenantId ? [username, tenantId] : [username],
        },
      ];

      for (const attempt of inactiveAttempts) {
        try {
          const inactiveResult = await query(attempt.sql, attempt.params);
          if (inactiveResult.rows.length > 0) {
            const inactiveUser = inactiveResult.rows[0];
            await writeAuditLog({
              tenantId: inactiveUser.tenant_id ?? (hasTenantId ? tenantId : null),
              userId: inactiveUser.id,
              userRole: normalizeRole(inactiveUser.role),
              action: 'LOGIN_BLOCKED',
              entityType: 'USER',
              module: 'security',
              status: 'failed',
              summary: `Login blocked — account deactivated (${inactiveUser.username})`,
              details: { username: inactiveUser.username },
              ipAddress: getClientIp(req),
              userAgent: req.get('user-agent') || null,
            });
            return res.status(403).json({
              error: 'Your account has been deactivated. Please contact your school administrator for help.',
            });
          }
        } catch {
          continue;
        }
      }

      const superAdminAttempt = normalizeRole(requestedRole) === 'super-admin' && !hasTenantId;
      await writeAuditLog({
        tenantId: hasTenantId ? tenantId : null,
        userId: null,
        userRole: null,
        action: superAdminAttempt ? 'SUPER_ADMIN_FAILED_LOGIN' : 'FAILED_LOGIN',
        entityType: 'USER',
        module: superAdminAttempt ? 'superadmin' : 'security',
        status: 'failed',
        summary: superAdminAttempt
          ? `Super Admin failed login — username "${String(username)}" not found`
          : `Failed login attempt — username "${String(username)}" not found`,
        details: { username: String(username).slice(0, 120), reason: 'unknown_username' },
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || null,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    const lockRes = await query(
      `SELECT locked_until, failed_login_attempts FROM users WHERE id = $1`,
      [user.id]
    ).catch(() => ({ rows: [{}] }));
    const lockRow = lockRes.rows[0] || {};
    const lockedUntil = lockRow.locked_until ? new Date(lockRow.locked_until) : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      const superAdmin = isSuperAdminUser(user.role, user.tenant_id);
      await writeAuditLog({
        tenantId: user.tenant_id,
        userId: user.id,
        userRole: normalizeRole(user.role),
        action: superAdmin ? 'SUPER_ADMIN_LOGIN_BLOCKED' : 'LOGIN_BLOCKED',
        entityType: 'USER',
        module: superAdmin ? 'superadmin' : 'security',
        status: 'failed',
        summary: superAdmin ? `Super Admin login blocked — ${user.username}` : 'Login blocked — account temporarily locked',
        details: { username: user.username, lockedUntil: lockedUntil.toISOString() },
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || null,
      });
      return res.status(423).json({
        error: isSuperAdminUser(user.role, user.tenant_id)
          ? 'This Super Admin username is locked until tomorrow after 3 failed attempts.'
          : 'Account temporarily locked after multiple failed attempts. Try again later or contact an administrator.',
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      const superAdmin = isSuperAdminUser(user.role, user.tenant_id);
      await query(
        superAdmin
          ? `UPDATE users SET
               failed_login_attempts = failed_login_attempts + 1,
               locked_until = CASE WHEN failed_login_attempts + 1 >= 3 THEN ${nextDayLockSql} ELSE locked_until END
             WHERE id = $1`
          : `UPDATE users SET
               failed_login_attempts = failed_login_attempts + 1,
               locked_until = CASE WHEN failed_login_attempts + 1 >= 5 THEN NOW() + interval '15 minutes' ELSE locked_until END
             WHERE id = $1`,
        [user.id]
      ).catch(() => {});
      const displayName = await resolveUserDisplayName(user.id);
      await writeAuditLog({
        tenantId: user.tenant_id,
        userId: user.id,
        userRole: normalizeRole(user.role),
        action: superAdmin ? 'SUPER_ADMIN_FAILED_LOGIN' : 'FAILED_LOGIN',
        entityType: 'USER',
        module: superAdmin ? 'superadmin' : 'security',
        status: 'failed',
        summary: superAdmin
          ? `Super Admin failed login — ${displayName}`
          : `Failed login attempt — ${displayName}`,
        details: {
          username: user.username,
          lockPolicy: superAdmin ? '3 failed attempts locks until the next day' : '5 failed attempts locks for 15 minutes',
        },
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || null,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [user.id]).catch(() => {});

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: normalizeRole(user.role) },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    const superAdmin = isSuperAdminUser(user.role, user.tenant_id);
    const displayName = await resolveUserDisplayName(user.id);
    await writeAuditLog({
      tenantId: user.tenant_id,
      userId: user.id,
      userRole: normalizeRole(user.role),
      action: superAdmin ? 'SUPER_ADMIN_LOGIN' : 'LOGIN',
      entityType: 'USER',
      module: superAdmin ? 'superadmin' : 'security',
      status: 'success',
      summary: superAdmin ? `Super Admin login — ${displayName}` : `Successful login — ${displayName}`,
      details: { username: user.username, role: normalizeRole(user.role) },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });
    
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
    
    const displayName = await resolveUserDisplayName(req.user!.id);
    await writeAuditLog({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'PASSWORD_CHANGE',
      entityType: 'USER',
      module: 'security',
      status: 'success',
      summary: `Password changed — ${displayName}`,
      details: { username: req.user!.username, fullName: displayName },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Logout - logs LOGOUT for audit
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    const displayName = await resolveUserDisplayName(req.user!.id);
    await writeAuditLog({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'LOGOUT',
      entityType: 'USER',
      module: 'security',
      status: 'success',
      summary: `Logout — ${displayName}`,
      details: { username: req.user!.username, fullName: displayName },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });
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
              COALESCE(t.full_name, s.full_name, u.full_name, u.username) as full_name
       FROM users u
       LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
       LEFT JOIN other_staff s ON u.other_staff_id = s.id AND s.tenant_id = u.tenant_id
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

/** Browser heartbeat — marks this tab as active (works without WebSockets). */
router.post('/session-pulse', authenticate, async (req: AuthRequest, res) => {
  try {
    const clientSessionId = String(req.body?.clientSessionId || '').trim();
    if (!clientSessionId || clientSessionId.length > 120) {
      return res.status(400).json({ error: 'clientSessionId required' });
    }
    const user = req.user!;
    await pulseHttpSession(clientSessionId, {
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
    });
    try {
      getIO().to('global:super-admin').emit('super-admin-online-users-updated', { updatedAt: Date.now() });
    } catch {
      // Socket optional
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('session-pulse error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

router.post('/session-end', authenticate, async (req: AuthRequest, res) => {
  try {
    const clientSessionId = String(req.body?.clientSessionId || '').trim();
    if (clientSessionId) {
      await clearHttpSession(clientSessionId);
      try {
        getIO().to('global:super-admin').emit('super-admin-online-users-updated', { updatedAt: Date.now() });
      } catch {
        // Socket optional
      }
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('session-end error:', error);
    res.json({ ok: true });
  }
});

// Web push for teacher/staff school app (same VAPID keys as parent portal)
router.get('/push/public-key', authenticate, async (req: AuthRequest, res) => {
  const role = normalizeRole(req.user!.role);
  if (role !== 'teacher' && role !== 'staff' && role !== 'headmaster') {
    return res.status(403).json({ error: 'Only teacher, staff, or headmaster accounts can use school push' });
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
    if (role !== 'teacher' && role !== 'staff' && role !== 'headmaster') {
      return res.status(403).json({ error: 'Only teacher, staff, or headmaster accounts can subscribe' });
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
