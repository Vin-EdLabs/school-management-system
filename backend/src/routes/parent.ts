import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';
import { getVapidPublicKey } from '../services/webPushService.js';
import { resolveTenant, TenantRequest } from '../middleware/tenantResolver.js';
import { authenticate, requireRole, validateTenantAccess, AuthRequest } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditService.js';
import { beneficiaryAdjustedFee } from '../utils/beneficiaryFee.js';

const router = express.Router();

function parentJwtExpiresIn(): jwt.SignOptions['expiresIn'] {
  const raw = process.env.PARENT_JWT_EXPIRES_IN?.trim();
  return (raw && raw.length > 0 ? raw : '365d') as jwt.SignOptions['expiresIn'];
}

// ── Parent JWT middleware ─────────────────────────────────────────────────────

interface ParentRequest extends express.Request {
  parent?: { accountId: number; studentId: number; tenantId: number };
}

const authenticateParent = async (
  req: ParentRequest,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    if (decoded.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });

    const row = await query(
      'SELECT id, student_id, tenant_id FROM parent_portal_accounts WHERE id = $1 AND is_active = true',
      [decoded.parentAccountId]
    );
    if (row.rows.length === 0) return res.status(401).json({ error: 'Invalid token' });

    req.parent = {
      accountId: row.rows[0].id,
      studentId: row.rows[0].student_id,
      tenantId: row.rows[0].tenant_id,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ── POST /api/parent/login ────────────────────────────────────────────────────
// Uses the student's admission number as both the username and default password.
// If no account exists yet it is created on first login with default pass = admission number.

router.post('/login', resolveTenant, async (req: ParentRequest & TenantRequest, res) => {
  try {
    const { tenantId: rawTenantId, studentId: admissionNumber, password } = req.body;
    const bodyTenantId = parseInt(String(rawTenantId), 10);
    const tenantId = !isNaN(bodyTenantId) && bodyTenantId > 0 ? bodyTenantId : (req.tenantId || null);
    if (!tenantId || !admissionNumber || !password) {
      return res.status(400).json({ error: 'tenantId (or tenant slug), studentId and password are required' });
    }

    // Verify tenant is active
    const tenantRow = await query('SELECT is_active FROM tenants WHERE id = $1', [tenantId]);
    if (!tenantRow.rows[0]?.is_active) {
      return res.status(403).json({ error: 'School account is suspended' });
    }

    // Look up student by their auto-generated student_id (e.g. "20260001")
    // Also try admission_number in case school uses that format instead
    const studentRow = await query(
      `SELECT id, first_name, last_name, student_id AS admission_number,
              class_assigned_id, passport_photo_url, guardian_name, guardian_contact
       FROM students
       WHERE tenant_id = $1
         AND (LOWER(student_id) = LOWER($2) OR LOWER(admission_number) = LOWER($2))`,
      [tenantId, admissionNumber]
    );
    if (studentRow.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid student ID or password' });
    }
    const student = studentRow.rows[0];

    // Get or create parent account
    let accountRow = await query(
      'SELECT id, password_hash, must_change_password, is_active FROM parent_portal_accounts WHERE tenant_id = $1 AND student_id = $2',
      [tenantId, student.id]
    );

    if (accountRow.rows.length === 0) {
      // First-ever login — create account, default password = admission number
      const hash = await bcrypt.hash(student.admission_number, 10);
      const inserted = await query(
        `INSERT INTO parent_portal_accounts (tenant_id, student_id, password_hash, must_change_password)
         VALUES ($1, $2, $3, true) RETURNING id, password_hash, must_change_password, is_active`,
        [tenantId, student.id, hash]
      );
      accountRow = inserted;
    }

    const account = accountRow.rows[0];
    if (account.is_active === false) {
      return res.status(403).json({ error: 'Parent account is disabled. Contact your school administrator.' });
    }

    const valid = await bcrypt.compare(password, account.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid student ID or password' });
    }

    // Update last login
    await query(
      'UPDATE parent_portal_accounts SET last_login = NOW() WHERE id = $1',
      [account.id]
    );

    const token = jwt.sign(
      { parentAccountId: account.id, studentId: student.id, tenantId, role: 'parent' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: parentJwtExpiresIn() }
    );

    res.json({
      token,
      mustChangePassword: account.must_change_password,
      student: {
        id: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        admissionNumber: student.admission_number,
        classId: student.class_assigned_id,
        passportPhotoUrl: student.passport_photo_url,
        guardianName: student.guardian_name,
        guardianContact: student.guardian_contact,
      },
    });
  } catch (error: any) {
    console.error('Parent login error:', error?.message || error);
    res.status(500).json({ error: 'Login failed', detail: error?.message });
  }
});

// ── POST /api/parent/refresh ─────────────────────────────────────────────────
// Issues a new JWT while the current one is still valid — keeps long-lived sessions fresh.

router.post('/refresh', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const token = jwt.sign(
      {
        parentAccountId: req.parent!.accountId,
        studentId: req.parent!.studentId,
        tenantId: req.parent!.tenantId,
        role: 'parent',
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: parentJwtExpiresIn() }
    );
    return res.json({ token });
  } catch (error) {
    console.error('Parent refresh error:', error);
    return res.status(500).json({ error: 'Failed to refresh session' });
  }
});

// ── POST /api/parent/change-password ─────────────────────────────────────────

router.post('/change-password', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: 'newPassword is required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const row = await query(
      'SELECT password_hash, must_change_password FROM parent_portal_accounts WHERE id = $1',
      [req.parent!.accountId]
    );
    const mustChange = !!row.rows[0]?.must_change_password;
    if (!mustChange) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'currentPassword is required' });
      }
      const valid = await bcrypt.compare(currentPassword, row.rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE parent_portal_accounts SET password_hash = $1, must_change_password = false WHERE id = $2',
      [hash, req.parent!.accountId]
    );
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Parent change-password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.get('/push/public-key', authenticateParent, async (_req: ParentRequest, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({ error: 'Push notifications are not configured yet' });
  }
  return res.json({ publicKey });
});

router.post('/push/subscribe', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Invalid push subscription payload' });
    }

    await query(
      `INSERT INTO parent_push_subscriptions (tenant_id, parent_account_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (parent_account_id, endpoint)
       DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [req.parent!.tenantId, req.parent!.accountId, endpoint, p256dh, auth]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Parent push subscribe error:', error);
    return res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

router.post('/push/unsubscribe', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });
    await query(
      'DELETE FROM parent_push_subscriptions WHERE parent_account_id = $1 AND endpoint = $2',
      [req.parent!.accountId, endpoint]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Parent push unsubscribe error:', error);
    return res.status(500).json({ error: 'Failed to remove push subscription' });
  }
});

router.post('/push/fcm-token', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token is required' });
    await query(
      `INSERT INTO parent_fcm_tokens (tenant_id, parent_account_id, token)
       VALUES ($1, $2, $3)
       ON CONFLICT (parent_account_id, token)
       DO UPDATE SET updated_at = CURRENT_TIMESTAMP`,
      [req.parent!.tenantId, req.parent!.accountId, token]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Parent FCM token save error:', error);
    return res.status(500).json({ error: 'Failed to save FCM token' });
  }
});

router.post('/push/fcm-unsubscribe', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) {
      await query(
        'DELETE FROM parent_fcm_tokens WHERE parent_account_id = $1',
        [req.parent!.accountId]
      );
    } else {
      await query(
        'DELETE FROM parent_fcm_tokens WHERE parent_account_id = $1 AND token = $2',
        [req.parent!.accountId, token]
      );
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Parent FCM token remove error:', error);
    return res.status(500).json({ error: 'Failed to remove FCM token' });
  }
});

router.get('/notifications', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const rows = await query(
      `SELECT id, title, message, url, icon, is_read, created_at
       FROM parent_notifications
       WHERE parent_account_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.parent!.accountId]
    );
    return res.json({ notifications: rows.rows });
  } catch (error) {
    console.error('Parent notifications error:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.post('/notifications/:id/read', authenticateParent, async (req: ParentRequest, res) => {
  try {
    await query(
      `UPDATE parent_notifications
       SET is_read = true, read_at = NOW()
       WHERE id = $1 AND parent_account_id = $2`,
      [req.params.id, req.parent!.accountId]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Parent mark notification read error:', error);
    return res.status(500).json({ error: 'Failed to update notification' });
  }
});

router.post('/notifications/read-all', authenticateParent, async (req: ParentRequest, res) => {
  try {
    await query(
      `UPDATE parent_notifications
       SET is_read = true, read_at = NOW()
       WHERE parent_account_id = $1 AND is_read = false`,
      [req.parent!.accountId]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Parent mark all notifications read error:', error);
    return res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// ── GET /api/parent/me ────────────────────────────────────────────────────────

router.get('/me', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { studentId, tenantId } = req.parent!;

    const result = await query(
      `SELECT
         s.id, s.first_name, s.last_name, s.student_id AS admission_number,
         s.gender, s.date_of_birth, s.class_assigned_id,
         s.passport_photo_url,
         COALESCE(c.class_name, TRIM(CONCAT(COALESCE(c.level, ''), ' ', COALESCE(c.stream, '')))) AS class_name,
         c.level,
         t.name AS tenant_name,
         COALESCE(ss.logo_url, t.logo_url) AS school_logo_url,
         COALESCE(ss.school_name, t.name) AS school_name,
         COALESCE(
           NULLIF(ss.current_term, ''),
           NULLIF(at.term_name, '')
         ) AS current_term,
         COALESCE(
           NULLIF(ss.current_year, ''),
           NULLIF(at.year::text, '')
         ) AS current_year,
         pa.must_change_password, pa.last_login,
         s.is_beneficiary, s.beneficiary_type, s.discount_type, s.discount_value, s.beneficiary_notes, s.guardian_name, s.guardian_contact
       FROM students s
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       LEFT JOIN tenants t ON s.tenant_id = t.id
       LEFT JOIN school_settings ss ON ss.tenant_id = s.tenant_id
       LEFT JOIN LATERAL (
         SELECT term_name, year
         FROM academic_terms
         WHERE tenant_id = s.tenant_id AND is_active = true
         ORDER BY updated_at DESC NULLS LAST, id DESC
         LIMIT 1
       ) at ON true
       LEFT JOIN parent_portal_accounts pa ON pa.student_id = s.id AND pa.tenant_id = s.tenant_id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [studentId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Parent me error:', error);
    res.status(500).json({ error: 'Failed to fetch student info' });
  }
});
 
// ── POST /api/parent/link-siblings ───────────────────────────────────────────
// Links two students as siblings in the database if they share the same guardian.
 
router.post('/link-siblings', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { studentId: currentStudentId, tenantId } = req.parent!;
    const { targetStudentId } = req.body;
 
    if (!targetStudentId) {
      return res.status(400).json({ error: 'targetStudentId is required' });
    }
 
    // Fetch both students
    const students = await query(
      `SELECT id, first_name, last_name, guardian_name, guardian_contact, names_of_siblings, number_of_siblings
       FROM students
       WHERE id IN ($1, $2) AND tenant_id = $3`,
      [currentStudentId, targetStudentId, tenantId]
    );
 
    if (students.rows.length < 2) {
      return res.status(404).json({ error: 'One or both students not found' });
    }
 
    const studentA = students.rows.find(s => s.id === currentStudentId);
    const studentB = students.rows.find(s => s.id === targetStudentId);
 
    // Verify guardian name matches (case-insensitive, trimmed)
    const gA = (studentA.guardian_name || '').trim().toLowerCase();
    const gB = (studentB.guardian_name || '').trim().toLowerCase();
 
    // Verify guardian contact matches (normalized digits only)
    const cA = (studentA.guardian_contact || '').replace(/\D/g, '');
    const cB = (studentB.guardian_contact || '').replace(/\D/g, '');
 
    if (!gA || !gB || gA !== gB) {
      return res.status(403).json({ error: 'Guardian name mismatch.' });
    }
    
    if (!cA || !cB || cA !== cB) {
      return res.status(403).json({ error: 'Guardian phone number mismatch.' });
    }
 
    // Update both records
    const updateStudent = async (student: any, sibling: any) => {
      const existingSiblings = (student.names_of_siblings || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      const siblingFullName = `${sibling.first_name} ${sibling.last_name}`;
      
      if (!existingSiblings.includes(siblingFullName)) {
        existingSiblings.push(siblingFullName);
        await query(
          `UPDATE students 
           SET names_of_siblings = $1, number_of_siblings = $2, updated_at = NOW()
           WHERE id = $3`,
          [existingSiblings.join(', '), existingSiblings.length, student.id]
        );
      }
    };
 
    await updateStudent(studentA, studentB);
    await updateStudent(studentB, studentA);
 
    res.json({ success: true, message: 'Siblings linked successfully' });
  } catch (error) {
    console.error('Link siblings error:', error);
    res.status(500).json({ error: 'Failed to link siblings' });
  }
});

function normalizeSearchTerm(value: string): string {
  return value.trim().toLowerCase();
}

const adminRouter = express.Router();
adminRouter.use(authenticate, requireRole('super-admin', 'administrator'), validateTenantAccess);

adminRouter.get('/accounts', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(String(req.query.tenantId || req.user?.tenantId), 10);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const search = normalizeSearchTerm(String(req.query.search || ''));
    const status = String(req.query.status || 'all').toLowerCase();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;
    const params: any[] = [tenantId];
    let sql = `
      SELECT pa.id AS account_id,
             pa.student_id,
             pa.must_change_password,
             pa.last_login,
             pa.is_active,
             s.first_name,
             s.last_name,
             s.student_id AS admission_number,
             s.admission_number AS admission_number_legacy,
             s.guardian_name,
             s.guardian_contact,
             s.names_of_siblings,
             s.number_of_siblings,
             COALESCE(c.class_name, TRIM(CONCAT(COALESCE(c.level, ''), ' ', COALESCE(c.stream, '')))) AS class_name
      FROM students s
      LEFT JOIN parent_portal_accounts pa ON pa.student_id = s.id AND pa.tenant_id = s.tenant_id
      LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
      WHERE s.tenant_id = $1
        AND (COALESCE(s.guardian_name, '') <> '' OR COALESCE(s.guardian_contact, '') <> '')
    `;

    if (status === 'active') {
      sql += ' AND pa.is_active = true';
    } else if (status === 'inactive') {
      sql += ' AND pa.is_active = false';
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (
        LOWER(s.first_name || ' ' || s.last_name) LIKE $${params.length}
        OR LOWER(s.student_id) LIKE $${params.length}
        OR LOWER(s.admission_number) LIKE $${params.length}
        OR LOWER(s.guardian_name) LIKE $${params.length}
        OR LOWER(s.guardian_contact) LIKE $${params.length}
        OR LOWER(s.names_of_siblings) LIKE $${params.length}
      )`;
    }

    const countSql = `SELECT COUNT(*)::int AS total FROM (${sql}) AS count_query`;
    const countResult = await query(countSql, params);
    const total = Number(countResult.rows[0]?.total ?? 0);

    sql += ' ORDER BY s.last_name, s.first_name, s.student_id LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    const listParams = [...params, limit, offset];
    const result = await query(sql, listParams);

    const accounts = result.rows.map((row: any) => ({
      accountId: row.account_id ?? null,
      studentId: row.student_id,
      admissionNumber: row.admission_number || row.admission_number_legacy,
      studentName: `${row.first_name} ${row.last_name}`,
      className: row.class_name || 'Unassigned',
      guardianName: row.guardian_name,
      guardianContact: row.guardian_contact,
      siblingCount: Number(row.number_of_siblings) || 0,
      siblingNames: row.names_of_siblings || '',
      isActive: row.is_active === true,
      mustChangePassword: row.must_change_password,
      lastLogin: row.last_login,
    }));

    return res.json({ accounts, total, page, limit });
  } catch (error) {
    console.error('Admin parent accounts list error:', error);
    return res.status(500).json({ error: 'Failed to list parent accounts' });
  }
});

adminRouter.post('/accounts', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(String(req.query.tenantId || req.user?.tenantId), 10);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const studentId = Number(req.body.studentId);
    if (!studentId || Number.isNaN(studentId)) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const studentResult = await query(
      'SELECT student_id FROM students WHERE id = $1 AND tenant_id = $2',
      [studentId, tenantId]
    );
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found for this tenant' });
    }

    const existing = await query(
      'SELECT id FROM parent_portal_accounts WHERE tenant_id = $1 AND student_id = $2',
      [tenantId, studentId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Parent account already exists for this student' });
    }

    const studentIdentifier = studentResult.rows[0].student_id || '';
    const passwordHash = await bcrypt.hash(studentIdentifier, 10);
    const inserted = await query(
      `INSERT INTO parent_portal_accounts (tenant_id, student_id, password_hash, must_change_password)
       VALUES ($1, $2, $3, true)
       RETURNING id, is_active, must_change_password, last_login`,
      [tenantId, studentId, passwordHash]
    );

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      action: 'create_parent_account',
      entityType: 'parent_portal_account',
      entityId: inserted.rows[0].id,
      summary: 'Admin created parent portal account',
      details: { studentId, defaultPassword: 'student_id' },
    });

    return res.status(201).json({ success: true, accountId: inserted.rows[0].id });
  } catch (error) {
    console.error('Admin create parent account error:', error);
    return res.status(500).json({ error: 'Failed to create parent account' });
  }
});

adminRouter.get('/accounts/:accountId', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(String(req.query.tenantId || req.user?.tenantId), 10);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const result = await query(
      `SELECT pa.id AS account_id,
              pa.student_id,
              pa.must_change_password,
              pa.last_login,
              pa.is_active,
              s.first_name,
              s.last_name,
              s.student_id AS admission_number,
              s.admission_number AS admission_number_legacy,
              s.guardian_name,
              s.guardian_contact,
              s.names_of_siblings,
              s.number_of_siblings,
              COALESCE(c.class_name, TRIM(CONCAT(COALESCE(c.level, ''), ' ', COALESCE(c.stream, '')))) AS class_name
       FROM parent_portal_accounts pa
       JOIN students s ON s.id = pa.student_id AND s.tenant_id = pa.tenant_id
       LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
       WHERE pa.tenant_id = $1 AND pa.id = $2`,
      [tenantId, Number(req.params.accountId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parent account not found' });
    }

    const row = result.rows[0];
    return res.json({
      accountId: row.account_id,
      studentId: row.student_id,
      admissionNumber: row.admission_number || row.admission_number_legacy,
      studentName: `${row.first_name} ${row.last_name}`,
      className: row.class_name || 'Unassigned',
      guardianName: row.guardian_name,
      guardianContact: row.guardian_contact,
      siblingCount: Number(row.number_of_siblings) || 0,
      siblingNames: row.names_of_siblings || '',
      isActive: row.is_active,
      mustChangePassword: row.must_change_password,
      lastLogin: row.last_login,
    });
  } catch (error) {
    console.error('Admin parent account details error:', error);
    return res.status(500).json({ error: 'Failed to fetch parent account details' });
  }
});

adminRouter.patch('/accounts/:accountId', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(String(req.query.tenantId || req.user?.tenantId), 10);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const accountId = Number(req.params.accountId);
    const { isActive, mustChangePassword, studentId } = req.body || {};
    const updates: string[] = [];
    const params: any[] = [];

    if (typeof isActive === 'boolean') {
      updates.push(`is_active = $${params.length + 1}`);
      params.push(isActive);
    }
    if (typeof mustChangePassword === 'boolean') {
      updates.push(`must_change_password = $${params.length + 1}`);
      params.push(mustChangePassword);
    }
    if (typeof studentId === 'number' && Number.isInteger(studentId) && studentId > 0) {
      const student = await query('SELECT id FROM students WHERE id = $1 AND tenant_id = $2', [studentId, tenantId]);
      if (student.rows.length === 0) {
        return res.status(400).json({ error: 'Student not found for this tenant' });
      }
      const conflict = await query(
        'SELECT id FROM parent_portal_accounts WHERE tenant_id = $1 AND student_id = $2 AND id != $3',
        [tenantId, studentId, accountId]
      );
      if (conflict.rows.length > 0) {
        return res.status(400).json({ error: 'Another parent account is already linked to that student' });
      }
      updates.push(`student_id = $${params.length + 1}`);
      params.push(studentId);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const existing = await query(
      `SELECT pa.is_active, pa.must_change_password, pa.student_id,
              s.guardian_name, s.guardian_contact
       FROM parent_portal_accounts pa
       JOIN students s ON s.id = pa.student_id AND s.tenant_id = pa.tenant_id
       WHERE pa.id = $1 AND pa.tenant_id = $2`,
      [accountId, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Parent account not found' });
    }

    const existingRow = existing.rows[0];
    if (typeof studentId === 'number' && Number.isInteger(studentId) && studentId > 0) {
      const studentTarget = await query(
        `SELECT guardian_name, guardian_contact FROM students WHERE id = $1 AND tenant_id = $2`,
        [studentId, tenantId]
      );
      if (studentTarget.rows.length === 0) {
        return res.status(400).json({ error: 'Student not found for this tenant' });
      }
      const targetRow = studentTarget.rows[0];

      const normalizeName = (value: string | null | undefined) => String(value || '').trim().toLowerCase();
      const normalizePhone = (value: string | null | undefined) => String(value || '').replace(/\D/g, '');

      if (
        normalizeName(existingRow.guardian_name) !== normalizeName(targetRow.guardian_name) ||
        normalizePhone(existingRow.guardian_contact) !== normalizePhone(targetRow.guardian_contact)
      ) {
        return res.status(400).json({
          error: 'Cannot link student: guardian name or contact does not match the current parent account.',
        });
      }
    }

    await query(
      `UPDATE parent_portal_accounts SET ${updates.join(', ')} WHERE id = $${params.length + 1} AND tenant_id = $${params.length + 2}`,
      [...params, accountId, tenantId]
    );

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      action: 'update_parent_account',
      entityType: 'parent_portal_account',
      entityId: accountId,
      summary: 'Admin updated parent account',
      details: {
        before: existing.rows[0],
        after: { isActive, mustChangePassword, studentId },
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Admin parent account update error:', error);
    return res.status(500).json({ error: 'Failed to update parent account' });
  }
});

adminRouter.post('/accounts/:accountId/reset-password', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(String(req.query.tenantId || req.user?.tenantId), 10);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const accountId = Number(req.params.accountId);
    const result = await query(
      `SELECT pa.id, pa.is_active, s.admission_number
       FROM parent_portal_accounts pa
       JOIN students s ON s.id = pa.student_id AND s.tenant_id = pa.tenant_id
       WHERE pa.id = $1 AND pa.tenant_id = $2`,
      [accountId, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parent account not found' });
    }

    const row = result.rows[0];
    const passwordHash = await bcrypt.hash(row.admission_number, 10);
    await query(
      `UPDATE parent_portal_accounts
       SET password_hash = $1, must_change_password = true
       WHERE id = $2 AND tenant_id = $3`,
      [passwordHash, accountId, tenantId]
    );

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      action: 'reset_parent_account_password',
      entityType: 'parent_portal_account',
      entityId: accountId,
      summary: 'Admin reset parent account password to admission number',
      details: { accountId, studentAdmissionNumber: row.admission_number },
    });

    return res.json({ success: true, message: 'Password has been reset to the student admission number.' });
  } catch (error) {
    console.error('Admin reset parent password error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

adminRouter.get('/accounts/:accountId/audit', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(String(req.query.tenantId || req.user?.tenantId), 10);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const accountId = Number(req.params.accountId);
    const rows = await query(
      `SELECT al.id, al.action, al.summary, al.details, al.created_at, u.username, u.role
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id AND u.tenant_id = al.tenant_id
       WHERE al.tenant_id = $1 AND al.entity_type = 'parent_portal_account' AND al.entity_id = $2
       ORDER BY al.created_at DESC
       LIMIT 100`,
      [tenantId, accountId]
    );

    return res.json({ audit: rows.rows });
  } catch (error) {
    console.error('Admin parent account audit error:', error);
    return res.status(500).json({ error: 'Failed to fetch audit history' });
  }
});

router.use('/admin', adminRouter);

// ── GET /api/parent/grades ────────────────────────────────────────────────────
// Returns all grades for the student grouped by subject, with assignment details

router.get('/grades', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { studentId, tenantId } = req.parent!;

    // Get current class for context
    const classRow = await query(
      'SELECT class_assigned_id FROM students WHERE id = $1 AND tenant_id = $2',
      [studentId, tenantId]
    );
    const classId = classRow.rows[0]?.class_assigned_id;

    const result = await query(
      `SELECT
         g.score,
         g.updated_at,
         a.id AS assignment_id,
         a.name AS assignment_name,
         a.assignment_type,
         a.max_score,
         a.subject,
         a.class_id,
         c.class_name,
         u.username AS graded_by
       FROM student_grades g
       JOIN grade_assignments a ON g.assignment_id = a.id
       JOIN classes c ON a.class_id = c.id
       LEFT JOIN users u ON g.graded_by = u.id
       WHERE g.tenant_id = $1 AND g.student_id = $2
       ORDER BY a.subject, a.assignment_type, a.name`,
      [tenantId, studentId]
    );

    res.json({ grades: result.rows, currentClassId: classId });
  } catch (error) {
    console.error('Parent grades error:', error);
    res.status(500).json({ error: 'Failed to fetch grades' });
  }
});

// ── GET /api/parent/term-report ───────────────────────────────────────────────
// Returns the full term report for the student's class, with the student's position

router.get('/term-report', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { studentId, tenantId } = req.parent!;

    // Get student's current class
    const studentRow = await query(
      `SELECT s.class_assigned_id, s.first_name, s.last_name, c.class_name
       FROM students s
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [studentId, tenantId]
    );
    if (!studentRow.rows[0]?.class_assigned_id) {
      return res.json({ report: null, message: 'Student not assigned to a class' });
    }
    const classId = studentRow.rows[0].class_assigned_id;
    const className = studentRow.rows[0].class_name;

    // Check if report has been released for this class+term
    const currentTermRow = await query(
      'SELECT current_term, current_year, school_name FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    const currentTerm = currentTermRow.rows[0]?.current_term || '';
    const currentYear = currentTermRow.rows[0]?.current_year || '';
    const schoolName = currentTermRow.rows[0]?.school_name || '';

    const releaseRow = await query(
      `SELECT is_released, released_at FROM term_report_releases
       WHERE tenant_id = $1 AND class_id = $2 AND term = $3`,
      [tenantId, classId, currentTerm]
    );
    const isReleased = releaseRow.rows[0]?.is_released ?? false;
    if (!isReleased) {
      return res.json({
        report: null,
        message: 'The term report has not been released by your teacher yet. Please check back later.',
      });
    }

    // Get all assignments for this class
    const assignmentsRes = await query(
      `SELECT id, subject, name, assignment_type, max_score
       FROM grade_assignments WHERE tenant_id = $1 AND class_id = $2
       ORDER BY subject, name`,
      [tenantId, classId]
    );
    const assignments = assignmentsRes.rows;
    if (assignments.length === 0) {
      return res.json({ report: null, message: 'No assessments recorded for this class' });
    }

    // Get all students currently in class (include photo)
    const classStudentsRes = await query(
      `SELECT id, first_name, last_name, student_id AS admission_number, passport_photo_url
       FROM students WHERE tenant_id = $1 AND class_assigned_id = $2
       ORDER BY first_name, last_name`,
      [tenantId, classId]
    );

    // Get all grades for this class
    const gradesRes = await query(
      `SELECT g.student_id, g.assignment_id, g.score
       FROM student_grades g
       JOIN grade_assignments a ON g.assignment_id = a.id
       WHERE g.tenant_id = $1 AND a.class_id = $2`,
      [tenantId, classId]
    );

    // Build grade map
    const gradeMap: Record<string, number> = {};
    for (const g of gradesRes.rows) {
      gradeMap[`${g.student_id}-${g.assignment_id}`] = parseFloat(g.score);
    }

    // Get unique subjects
    const subjects = [...new Set(assignments.map((a: any) => a.subject))];

    // Calculate totals per student
    const students = classStudentsRes.rows.map((s: any) => {
      const subjectScores: Record<string, { score: number; maxScore: number }> = {};
      let grandTotal = 0;
      let grandMax = 0;

      for (const subj of subjects) {
        const subjAssignments = assignments.filter((a: any) => a.subject === subj);
        let subjScore = 0;
        let subjMax = 0;
        for (const a of subjAssignments) {
          const score = gradeMap[`${s.id}-${a.id}`] ?? 0;
          subjScore += score;
          subjMax += parseFloat(a.max_score);
        }
        subjectScores[subj] = { score: subjScore, maxScore: subjMax };
        grandTotal += subjScore;
        grandMax += subjMax;
      }

      return {
        studentId: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        admissionNumber: s.admission_number,
        passportPhotoUrl: s.passport_photo_url || null,
        subjectScores,
        grandTotal,
        grandMax,
        percentage: grandMax > 0 ? Math.round((grandTotal / grandMax) * 100) : 0,
        isCurrentStudent: s.id === studentId,
      };
    });

    // Sort by grandTotal desc and assign positions
    students.sort((a: any, b: any) => b.grandTotal - a.grandTotal);
    let currentPosition = 1;
    for (let i = 0; i < students.length; i++) {
      if (i > 0 && students[i].grandTotal < students[i - 1].grandTotal) {
        currentPosition = i + 1;
      }
      (students[i] as any).position = currentPosition;
    }

    res.json({
      report: {
        className,
        classId,
        subjects,
        assignments,
        students,
        totalStudents: students.length,
        myStudentId: studentId,
        currentTerm,
        currentYear,
        schoolName,
        releasedAt: releaseRow.rows[0]?.released_at || null,
      },
    });
  } catch (error) {
    console.error('Parent term-report error:', error);
    res.status(500).json({ error: 'Failed to fetch term report' });
  }
});

// ── GET /api/parent/finance ───────────────────────────────────────────────────
// Returns fees, arrears, payments and balance for the student

router.get('/finance', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { studentId, tenantId } = req.parent!;

    // Get current term from school settings
    const settingsRow = await query(
      'SELECT current_term, current_year, school_name FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    const currentTerm = settingsRow.rows[0]?.current_term || '';
    const currentYear = settingsRow.rows[0]?.current_year || '';
    const schoolName = settingsRow.rows[0]?.school_name || '';

    // Get student + class info
    const studentRow = await query(
      `SELECT s.first_name, s.last_name, s.student_id AS admission_number,
              s.is_beneficiary, s.beneficiary_type, s.discount_type, s.discount_value,
              c.class_name, c.id AS class_id
       FROM students s
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [studentId, tenantId]
    );
    const student = studentRow.rows[0];

    // Get fee structure for student's class + current term (legacy-safe)
    let feeRow;
    try {
      feeRow = await query(
        `SELECT
           COALESCE(total_amount, amount) AS total_amount,
           amount AS tuition_fee,
           0::numeric AS pta_fee,
           0::numeric AS sports_fee,
           0::numeric AS library_fee,
           0::numeric AS other_fee,
           term
         FROM fee_structures
         WHERE tenant_id = $1
           AND class_id = $2
           AND (term = $3 OR $3 LIKE term || '%' OR term LIKE $3 || '%' OR term IS NULL OR term = '')
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId, student?.class_id, currentTerm]
      );
    } catch {
      feeRow = await query(
        `SELECT
           amount AS total_amount,
           amount AS tuition_fee,
           0::numeric AS pta_fee,
           0::numeric AS sports_fee,
           0::numeric AS library_fee,
           0::numeric AS other_fee,
           term
         FROM fee_structures
          WHERE (tenant_id = $1 OR tenant_id IS NULL)
            AND class_id = $2
            AND (term = $3 OR $3 LIKE term || '%' OR term LIKE $3 || '%' OR term IS NULL OR term = '')
          ORDER BY created_at DESC LIMIT 1`,
        [tenantId, student?.class_id, currentTerm]
      );
    }
    const feeStructure = feeRow.rows[0] || null;

    // Get arrears for current term
    const arrearsRow = await query(
      `SELECT amount FROM term_arrears
       WHERE tenant_id = $1 AND student_id = $2 AND (current_term = $3 OR $3 LIKE current_term || '%' OR current_term LIKE $3 || '%')`,
      [tenantId, studentId, currentTerm]
    );
    const arrears = parseFloat(arrearsRow.rows[0]?.amount || '0');

    // Get payments for this student (legacy-safe)
    let paymentsRow;
    try {
      paymentsRow = await query(
        `SELECT
           p.id,
           COALESCE(p.amount_paid, p.amount) AS amount_paid,
           p.payment_date,
           p.payment_method,
           p.receipt_number,
           p.receipt_number AS reference_number,
           p.notes,
           p.term,
           p.receipt_snapshot
         FROM payments p
         WHERE p.tenant_id = $1 AND p.student_id = $2
         ORDER BY p.payment_date DESC`,
        [tenantId, studentId]
      );
    } catch {
      try {
        paymentsRow = await query(
          `SELECT
             p.id,
             COALESCE(p.amount_paid, p.amount) AS amount_paid,
             p.payment_date,
             ''::text AS payment_method,
             p.receipt_number,
             ''::text AS reference_number,
             p.notes,
             ''::text AS term,
             NULL::jsonb AS receipt_snapshot
           FROM payments p
           WHERE p.tenant_id = $1 AND p.student_id = $2
           ORDER BY p.payment_date DESC`,
          [tenantId, studentId]
        );
      } catch {
        paymentsRow = await query(
          `SELECT
             p.id,
             COALESCE(p.amount_paid, p.amount) AS amount_paid,
             p.payment_date,
             ''::text AS payment_method,
             p.receipt_number,
             ''::text AS reference_number,
             ''::text AS notes,
             ''::text AS term,
             NULL::jsonb AS receipt_snapshot
           FROM payments p
           WHERE p.tenant_id = $1 AND p.student_id = $2
           ORDER BY p.payment_date DESC`,
          [tenantId, studentId]
        );
      }
    }
    const allPayments = paymentsRow.rows;

    // Payments for current term (legacy-safe):
    // if payment term is missing on old schema, treat it as current-term payment.
    const normalizedCurrentTerm = String(currentTerm || '').trim().toLowerCase();
    const termPayments = allPayments.filter((p: any) => {
      const paymentTerm = String(p?.term || '').trim().toLowerCase();
      if (!paymentTerm) return true;
      if (!normalizedCurrentTerm) return true;
      return (
        paymentTerm === normalizedCurrentTerm ||
        paymentTerm.includes(normalizedCurrentTerm) ||
        normalizedCurrentTerm.includes(paymentTerm)
      );
    });
    const totalPaidThisTerm = termPayments.reduce((s: number, p: any) => s + parseFloat(p.amount_paid), 0);
    const baseTermFee = parseFloat(feeStructure?.total_amount || '0');
    const { totalFees: termFee, discountAmount } = beneficiaryAdjustedFee(baseTermFee, student);
    const totalDue = termFee + arrears;
    const balance = totalDue - totalPaidThisTerm;

    res.json({
      schoolName,
      currentTerm,
      currentYear,
      student,
      feeStructure,
      baseTermFee,
      discountAmount,
      termFee,
      arrears,
      totalDue,
      totalPaid: totalPaidThisTerm,
      balance,
      status: balance <= 0 ? 'paid' : totalPaidThisTerm > 0 ? 'partial' : 'unpaid',
      payments: allPayments,
      termPayments,
    });
  } catch (error) {
    console.error('Parent finance error:', error);
    res.status(500).json({ error: 'Failed to fetch finance info' });
  }
});

// ── GET /api/parent/attendance ────────────────────────────────────────────────

router.get('/attendance', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { studentId, tenantId } = req.parent!;

    const result = await query(
      `SELECT
         a.attendance_date,
         a.present,
         c.class_name
       FROM attendance a
       JOIN classes c ON a.class_id = c.id
       WHERE a.tenant_id = $1 AND a.student_id = $2
       ORDER BY a.attendance_date DESC`,
      [tenantId, studentId]
    );

    const records = result.rows;
    const presentCount = records.filter((r: any) => r.present).length;
    const absentCount = records.filter((r: any) => !r.present).length;
    const totalDays = records.length;
    const rate = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;

    res.json({
      records,
      summary: { total: totalDays, present: presentCount, absent: absentCount, rate },
    });
  } catch (error) {
    console.error('Parent attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

export default router;
