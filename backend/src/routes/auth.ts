import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

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
    
    let userQuery = 'SELECT id, tenant_id, username, password_hash, role, teacher_id, is_primary_admin FROM users WHERE username = $1 AND is_active = true';
    const params: any[] = [username];
    
    if (hasTenantId) {
      userQuery += ' AND tenant_id = $2';
      params.push(tenantId);
    } else {
      userQuery += ' AND tenant_id IS NULL';
    }
    
    const result = await query(userQuery, params);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
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
        JSON.stringify({ username: user.username, role: user.role }),
      ]
    );
    
    const userRow = result.rows[0];
    const isPrimaryAdmin = userRow.is_primary_admin === true;
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenant_id,
        teacherId: user.teacher_id,
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
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
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
      'SELECT id, username, role, tenant_id, teacher_id, is_primary_admin FROM users WHERE id = $1',
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
        role: user.role,
        tenantId: user.tenant_id,
        teacherId: user.teacher_id,
        isPrimaryAdmin: user.is_primary_admin === true,
        tenant,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
