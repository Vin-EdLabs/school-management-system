import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';
import { getVapidPublicKey } from '../services/webPushService.js';
import { resolveTenant, TenantRequest } from '../middleware/tenantResolver.js';
import { authenticate, requireRole, validateTenantAccess, AuthRequest } from '../middleware/auth.js';
import { writeAuditLog } from '../services/auditService.js';
import {
  buildAuditContextFromParent,
  enrichImpersonatorTenant,
  runWithAuditContext,
} from '../middleware/auditContext.js';
import { beneficiaryAdjustedFee, type BeneficiaryStudentRow } from '../utils/beneficiaryFee.js';
import { buildStudentFinanceStatement } from '../services/studentFinanceStatementService.js';
import { getStudentLiveFeeBreakdown } from '../services/studentLiveFeeBreakdownService.js';
import { ensureTenantLedgerSynced } from '../services/ledgerBackfillService.js';
import { resolveActiveLedgerTerm } from '../services/studentUnifiedBalanceService.js';
import { getStudentBirthdaysForParent } from '../services/birthdayService.js';
import { loadActiveFeeStructureLinesByClassTerm } from '../services/feeStructureItemsService.js';
import {
  listAdmissionLetters,
  getAdmissionLetterPdf,
  enrichAdmissionLetterContent,
  type AdmissionLetterContent,
} from '../services/admissionLetterService.js';
import { getInvoiceById, getInvoicePdfPayload, listInvoices } from '../services/invoiceService.js';
import {
  buildParentReportFromArchive,
  getArchivedReportForStudentTerm,
} from '../services/reportCardArchiveService.js';
import { getSchoolActiveTermYear } from '../services/gradesTermContext.js';
import { loadStudentTermRemarks } from '../services/termReportRemarksService.js';
import { resolveParentFromToken, validateParentPortalHost } from '../middleware/authenticateParent.js';

const router = express.Router();

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function mapParentPortalStatus(b: {
  outstanding: number;
  credit: number;
  status: string;
}): 'unpaid' | 'paid' | 'credit' | 'not_set' {
  if (b.status === 'NotSet') return 'not_set';
  if (b.credit > 0.001) return 'credit';
  if (b.outstanding > 0.001) return 'unpaid';
  return 'paid';
}

async function buildCurrentTermFeeLines(
  tenantId: number,
  classId: number | null,
  termId: number | null,
  netBilled: number,
  beneficiary: BeneficiaryStudentRow
): Promise<{ lines: Array<{ label: string; amount: number }>; discountAmount: number; subtotal: number }> {
  if (!classId || !termId) {
    return {
      lines: netBilled > 0 ? [{ label: 'Total Term Bill', amount: netBilled }] : [],
      discountAmount: 0,
      subtotal: netBilled,
    };
  }

  const structureLines = await loadActiveFeeStructureLinesByClassTerm(tenantId, classId, termId);
  if (!structureLines) {
    return {
      lines: netBilled > 0 ? [{ label: 'Total Term Bill', amount: netBilled }] : [],
      discountAmount: 0,
      subtotal: netBilled,
    };
  }

  const { lines, subtotal } = structureLines;
  const { discountAmount } = beneficiaryAdjustedFee(subtotal, beneficiary);
  return {
    lines: lines.length > 0 ? lines : netBilled > 0 ? [{ label: 'Total Term Bill', amount: netBilled }] : [],
    discountAmount: roundMoney(discountAmount),
    subtotal,
  };
}

function parentJwtExpiresIn(): jwt.SignOptions['expiresIn'] {
  const raw = process.env.PARENT_JWT_EXPIRES_IN?.trim();
  return (raw && raw.length > 0 ? raw : '365d') as jwt.SignOptions['expiresIn'];
}

// ── Parent JWT middleware ─────────────────────────────────────────────────────

interface ParentRequest extends express.Request {
  parent?: { accountId: number; studentId: number; tenantId: number; impersonatorId?: number | null };
}

const authenticateParent = async (
  req: ParentRequest,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const resolved = await resolveParentFromToken(token);
    if (!resolved) return res.status(401).json({ error: 'Invalid token' });

    const hostCheck = await validateParentPortalHost(req, resolved.parent.tenantId);
    if (!hostCheck.ok) return res.status(hostCheck.status).json({ error: hostCheck.error });

    req.parent = resolved.parent;
    const { decoded } = resolved;

    let ctx = buildAuditContextFromParent({
      impersonatorId: req.parent.impersonatorId,
      impersonatorRole: decoded.impersonatorRole ?? null,
      tenantId: req.parent.tenantId,
      studentId: req.parent.studentId,
      accountId: req.parent.accountId,
    });
    if (ctx.impersonator) {
      ctx = {
        ...ctx,
        impersonator: await enrichImpersonatorTenant(ctx.impersonator, query),
      };
    }
    runWithAuditContext(ctx, () => next());
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
      `SELECT id, first_name, last_name, student_id, admission_number,
              class_assigned_id, passport_photo_url, guardian_name, guardian_contact
       FROM students
       WHERE tenant_id = $1
         AND (
           LOWER(TRIM(student_id)) = LOWER($2)
           OR LOWER(TRIM(COALESCE(admission_number, ''))) = LOWER($2)
         )`,
      [tenantId, admissionNumber.trim()]
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
      const loginId = defaultParentPortalPassword(student);
      if (!loginId) {
        return res.status(401).json({ error: 'Invalid student ID or password' });
      }
      const hash = await bcrypt.hash(loginId, 10);
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

    // First-time login uses Student ID as both username and password — always force a password change.
    const defaultLoginId = defaultParentPortalPassword(student);
    if (defaultLoginId && password === defaultLoginId && !account.must_change_password) {
      await query(
        'UPDATE parent_portal_accounts SET must_change_password = true WHERE id = $1',
        [account.id]
      );
      account.must_change_password = true;
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

    const linkedAccounts = await buildLinkedAccountsPayload(tenantId, account.id, student.id);

    res.json({
      token,
      mustChangePassword: account.must_change_password,
      linkedAccounts,
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
      return res.status(400).json({ error: 'Please enter a new password' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const row = await query(
      `SELECT pa.password_hash, pa.must_change_password, s.student_id, s.admission_number
       FROM parent_portal_accounts pa
       JOIN students s ON s.id = pa.student_id AND s.tenant_id = pa.tenant_id
       WHERE pa.id = $1 AND pa.tenant_id = $2`,
      [req.parent!.accountId, req.parent!.tenantId]
    );
    const accountRow = row.rows[0];
    if (!accountRow) {
      return res.status(404).json({ error: 'Parent account not found' });
    }

    const mustChange = !!accountRow.must_change_password;
    const defaultLoginId = defaultParentPortalPassword(accountRow);
    const stillOnDefaultPassword = defaultLoginId
      ? await bcrypt.compare(defaultLoginId, accountRow.password_hash)
      : false;

    if (!mustChange && !stillOnDefaultPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Please enter your current password' });
      }
      const valid = await bcrypt.compare(currentPassword, accountRow.password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE parent_portal_accounts SET password_hash = $1, must_change_password = false WHERE id = $2 AND tenant_id = $3',
      [hash, req.parent!.accountId, req.parent!.tenantId]
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
    const { studentId, tenantId, impersonatorId } = req.parent!;
    const profile = await fetchParentStudentProfile(tenantId, studentId);
    if (!profile) {
      return res.status(404).json({ error: 'Student not found' });
    }
    if (impersonatorId) {
      profile.must_change_password = false;
    }
    res.json(profile);
  } catch (error) {
    console.error('Parent me error:', error);
    res.status(500).json({ error: 'Failed to fetch student info' });
  }
});

router.get('/linked-accounts', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { accountId, studentId, tenantId } = req.parent!;
    const linkedAccounts = await buildLinkedAccountsPayload(tenantId, accountId, studentId);
    return res.json({ linkedAccounts });
  } catch (error) {
    console.error('Parent linked accounts error:', error);
    return res.status(500).json({ error: 'Failed to fetch linked accounts' });
  }
});

// ── POST /api/parent/switch-account ───────────────────────────────────────────
// Issue a JWT for a sibling in the same family group (explicit switch only).

router.post('/switch-account', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { accountId, studentId: currentStudentPk, tenantId } = req.parent!;
    const studentLoginId = String(req.body?.studentId || req.body?.admissionNumber || '').trim();
    if (!studentLoginId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const targetPk = await resolveStudentInternalId(tenantId, studentLoginId);
    if (!targetPk) {
      return res.status(403).json({ error: 'Student not found' });
    }

    const isSelf = targetPk === currentStudentPk;
    if (!isSelf && !(await isStudentInAccountFamily(tenantId, accountId, targetPk))) {
      return res.status(403).json({ error: 'Student not found' });
    }

    const targetAccount = await query(
      `SELECT pa.id
       FROM parent_portal_accounts pa
       JOIN students s ON s.id = pa.student_id AND s.tenant_id = pa.tenant_id
       WHERE pa.tenant_id = $1 AND pa.student_id = $2 AND pa.is_active = true`,
      [tenantId, targetPk]
    );
    if (targetAccount.rows.length === 0) {
      return res.status(403).json({ error: 'Student not found' });
    }

    const profile = await fetchParentStudentProfile(tenantId, targetPk);
    if (!profile) {
      return res.status(403).json({ error: 'Student not found' });
    }

    const token = await issueParentToken(Number(targetAccount.rows[0].id), targetPk, tenantId);
    return res.json({ token, student: profile });
  } catch (error) {
    console.error('Parent switch account error:', error);
    return res.status(500).json({ error: 'Failed to switch account' });
  }
});

// ── POST /api/parent/link-student ────────────────────────────────────────────
// Link another student in the same school to this parent's family group.

router.post('/link-student', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { accountId, studentId: anchorStudentPk, tenantId } = req.parent!;
    const studentLoginIds = parseStudentLoginIds(req.body);
    if (studentLoginIds.length === 0) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const results: LinkSiblingResult[] = [];
    for (const studentLoginId of studentLoginIds) {
      results.push(
        await linkSiblingStudentToAccount(tenantId, accountId, anchorStudentPk, studentLoginId)
      );
    }

    const notFound = results.filter((result) => result.status === 'not_found');
    if (notFound.length > 0 && results.every((result) => result.status === 'not_found')) {
      return res.status(403).json({ error: 'Student not found' });
    }

    const linkedAccounts = await buildLinkedAccountsPayload(tenantId, accountId, anchorStudentPk);
    return res.json({ linkedAccounts, results });
  } catch (error) {
    console.error('Parent link student error:', error);
    return res.status(500).json({ error: 'Failed to link student' });
  }
});

// ── GET /api/parent/birthdays ──────────────────────────────────────────────────

router.get('/birthdays', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { studentId, tenantId } = req.parent!;
    const birthdays = await getStudentBirthdaysForParent(tenantId, [studentId]);
    return res.json({ birthdays });
  } catch (error) {
    console.error('Parent birthdays error:', error);
    return res.status(500).json({ error: 'Failed to fetch birthdays' });
  }
});

// ── POST /api/parent/link-siblings ───────────────────────────────────────────
// Links two students as siblings in the database (no guardian validation — admin controls student IDs).

router.post('/link-siblings', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { studentId: currentStudentId, tenantId } = req.parent!;
    const { targetStudentId } = req.body;

    if (!targetStudentId) {
      return res.status(400).json({ error: 'targetStudentId is required' });
    }

    const targetPk = await resolveStudentInternalId(tenantId, targetStudentId);
    if (!targetPk || targetPk === currentStudentId) {
      return res.status(403).json({ error: 'Student not found' });
    }

    const students = await query(
      `SELECT id, first_name, last_name, names_of_siblings, number_of_siblings
       FROM students
       WHERE id IN ($1, $2) AND tenant_id = $3`,
      [currentStudentId, targetPk, tenantId]
    );

    if (students.rows.length < 2) {
      return res.status(403).json({ error: 'Student not found' });
    }

    const studentA = students.rows.find((s) => s.id === currentStudentId);
    const studentB = students.rows.find((s) => s.id === targetPk);

    const updateStudent = async (student: any, sibling: any) => {
      const existingSiblings = (student.names_of_siblings || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      const siblingFullName = `${sibling.first_name} ${sibling.last_name}`;

      if (!existingSiblings.includes(siblingFullName)) {
        existingSiblings.push(siblingFullName);
        await query(
          `UPDATE students 
           SET names_of_siblings = $1, number_of_siblings = $2, updated_at = NOW()
           WHERE id = $3 AND tenant_id = $4`,
          [existingSiblings.join(', '), existingSiblings.length, student.id, tenantId]
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

/** Resolve students.id from internal PK or portal login id (student_id / admission_number). */
async function resolveStudentInternalId(
  tenantId: number,
  ref: string | number | null | undefined
): Promise<number | null> {
  if (ref == null || ref === '') return null;

  const asStr = String(ref).trim();
  if (!asStr) return null;

  const asNum = Number(asStr);
  if (Number.isInteger(asNum) && asNum > 0 && asNum < 1_000_000) {
    const byPk = await query(
      'SELECT id FROM students WHERE id = $1 AND tenant_id = $2',
      [asNum, tenantId]
    );
    if (byPk.rows.length > 0) return Number(byPk.rows[0].id);
  }

  const byCode = await query(
    `SELECT id FROM students
     WHERE tenant_id = $1
       AND (LOWER(student_id) = LOWER($2) OR LOWER(admission_number) = LOWER($2))`,
    [tenantId, asStr]
  );
  return byCode.rows.length > 0 ? Number(byCode.rows[0].id) : null;
}

function defaultParentPortalPassword(studentRow: { student_id?: string; admission_number?: string }): string {
  return String(studentRow.student_id || studentRow.admission_number || '').trim();
}

const PARENT_STUDENT_PROFILE_SQL = `
  SELECT
    s.id,
    s.tenant_id,
    s.first_name,
    s.last_name,
    s.student_id AS admission_number,
    s.gender,
    s.date_of_birth,
    s.class_assigned_id,
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
    pa.id AS account_id,
    pa.must_change_password,
    pa.last_login,
    s.is_beneficiary,
    s.beneficiary_type,
    s.discount_type,
    s.discount_value,
    s.beneficiary_notes,
    s.guardian_name,
    s.guardian_contact,
    s.names_of_siblings
  FROM students s
  LEFT JOIN classes c ON s.class_assigned_id = c.id AND c.tenant_id = s.tenant_id
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
`;

async function fetchParentStudentProfile(tenantId: number, studentPk: number) {
  const result = await query(
    `${PARENT_STUDENT_PROFILE_SQL}
     WHERE s.id = $1 AND s.tenant_id = $2`,
    [studentPk, tenantId]
  );
  return result.rows[0] || null;
}

async function ensureParentPortalAccount(tenantId: number, studentPk: number) {
  const existing = await query(
    `SELECT id, student_id, family_group_id, must_change_password, is_active
     FROM parent_portal_accounts
     WHERE tenant_id = $1 AND student_id = $2`,
    [tenantId, studentPk]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const studentResult = await query(
    'SELECT id, student_id, admission_number FROM students WHERE id = $1 AND tenant_id = $2',
    [studentPk, tenantId]
  );
  if (studentResult.rows.length === 0) {
    throw new Error('Student not found');
  }
  const loginId = defaultParentPortalPassword(studentResult.rows[0]);
  if (!loginId) {
    throw new Error('Student has no portal login ID configured');
  }
  const hash = await bcrypt.hash(loginId, 10);
  const inserted = await query(
    `INSERT INTO parent_portal_accounts (tenant_id, student_id, password_hash, must_change_password)
     VALUES ($1, $2, $3, true)
     RETURNING id, student_id, family_group_id, must_change_password, is_active`,
    [tenantId, studentPk, hash]
  );
  return inserted.rows[0];
}

async function createFamilyGroupId(tenantId: number): Promise<number> {
  const result = await query(
    'INSERT INTO parent_portal_family_groups (tenant_id) VALUES ($1) RETURNING id',
    [tenantId]
  );
  return Number(result.rows[0].id);
}

async function assignAccountFamilyGroup(tenantId: number, accountId: number, groupId: number) {
  await query(
    'UPDATE parent_portal_accounts SET family_group_id = $1 WHERE id = $2 AND tenant_id = $3',
    [groupId, accountId, tenantId]
  );
}

async function mergeFamilyGroups(tenantId: number, keepGroupId: number, mergeGroupId: number) {
  if (keepGroupId === mergeGroupId) return;
  await query(
    'UPDATE parent_portal_accounts SET family_group_id = $1 WHERE tenant_id = $2 AND family_group_id = $3',
    [keepGroupId, tenantId, mergeGroupId]
  );
  await query(
    'DELETE FROM parent_portal_family_groups WHERE id = $1 AND tenant_id = $2',
    [mergeGroupId, tenantId]
  );
}

async function linkParentAccountsInFamily(tenantId: number, accountAId: number, accountBId: number) {
  if (accountAId === accountBId) return;

  const accounts = await query(
    `SELECT id, family_group_id
     FROM parent_portal_accounts
     WHERE tenant_id = $1 AND id IN ($2, $3)`,
    [tenantId, accountAId, accountBId]
  );
  const accountA = accounts.rows.find((row) => Number(row.id) === accountAId);
  const accountB = accounts.rows.find((row) => Number(row.id) === accountBId);
  if (!accountA || !accountB) {
    throw new Error('Parent account not found');
  }

  const groupA = accountA.family_group_id ? Number(accountA.family_group_id) : null;
  const groupB = accountB.family_group_id ? Number(accountB.family_group_id) : null;

  let keepGroupId = groupA || groupB;
  if (!keepGroupId) {
    keepGroupId = await createFamilyGroupId(tenantId);
  }

  if (groupA && groupB && groupA !== groupB) {
    await mergeFamilyGroups(tenantId, keepGroupId, keepGroupId === groupA ? groupB : groupA);
  }

  await assignAccountFamilyGroup(tenantId, accountAId, keepGroupId);
  await assignAccountFamilyGroup(tenantId, accountBId, keepGroupId);
}

function parseStudentLoginIds(body: Record<string, unknown> | null | undefined): string[] {
  const rawList = body?.studentLoginIds;
  if (Array.isArray(rawList)) {
    return [...new Set(rawList.map((value) => String(value).trim()).filter(Boolean))];
  }
  const single = String(body?.studentLoginId || body?.studentId || '').trim();
  if (!single) return [];
  return [...new Set(single.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean))];
}

async function isStudentInAccountFamily(
  tenantId: number,
  accountId: number,
  studentPk: number
): Promise<boolean> {
  const result = await query(
    `SELECT 1
     FROM parent_portal_accounts anchor
     JOIN parent_portal_accounts sibling
       ON sibling.tenant_id = anchor.tenant_id
      AND sibling.family_group_id = anchor.family_group_id
      AND sibling.student_id = $3
     WHERE anchor.id = $1
       AND anchor.tenant_id = $2
       AND anchor.family_group_id IS NOT NULL`,
    [accountId, tenantId, studentPk]
  );
  return result.rows.length > 0;
}

type LinkSiblingResult =
  | { status: 'linked'; studentLoginId: string; studentName: string }
  | { status: 'already_linked'; studentLoginId: string; studentName: string }
  | { status: 'not_found'; studentLoginId: string }
  | { status: 'self'; studentLoginId: string };

async function linkSiblingStudentToAccount(
  tenantId: number,
  accountId: number,
  anchorStudentPk: number,
  studentLoginId: string
): Promise<LinkSiblingResult> {
  const linkedStudentPk = await resolveStudentInternalId(tenantId, studentLoginId);
  if (!linkedStudentPk) {
    return { status: 'not_found', studentLoginId };
  }
  if (linkedStudentPk === anchorStudentPk) {
    return { status: 'self', studentLoginId };
  }

  const studentResult = await query(
    'SELECT first_name, last_name FROM students WHERE id = $1 AND tenant_id = $2',
    [linkedStudentPk, tenantId]
  );
  const studentName = studentResult.rows[0]
    ? `${studentResult.rows[0].first_name} ${studentResult.rows[0].last_name}`.trim()
    : studentLoginId;

  if (await isStudentInAccountFamily(tenantId, accountId, linkedStudentPk)) {
    return { status: 'already_linked', studentLoginId, studentName };
  }

  const linkedAccount = await ensureParentPortalAccount(tenantId, linkedStudentPk);
  await linkParentAccountsInFamily(tenantId, accountId, Number(linkedAccount.id));
  return { status: 'linked', studentLoginId, studentName };
}

async function syncFamilyFromStudentSiblingRecords(tenantId: number, anchorStudentPk: number, anchorAccountId: number) {
  const profile = await fetchParentStudentProfile(tenantId, anchorStudentPk);
  if (!profile) return;
  const namesStr = String(profile?.names_of_siblings || '');
  const anchorGuardianContact = String(profile?.guardian_contact || '').trim().toLowerCase();
  const anchorGuardianName = String(profile?.guardian_name || '').trim().toLowerCase();
  const matches = [...namesStr.matchAll(/\(([^)]+)\)/g)];
  for (const match of matches) {
    const siblingPk = await resolveStudentInternalId(tenantId, match[1]?.trim());
    if (!siblingPk || siblingPk === anchorStudentPk) continue;
    const siblingProfile = await fetchParentStudentProfile(tenantId, siblingPk);
    if (!siblingProfile || Number(siblingProfile.tenant_id) !== tenantId) continue;

    const siblingGuardianContact = String(siblingProfile.guardian_contact || '').trim().toLowerCase();
    const siblingGuardianName = String(siblingProfile.guardian_name || '').trim().toLowerCase();
    const hasAnchorGuardian = !!(anchorGuardianContact || anchorGuardianName);
    const hasSiblingGuardian = !!(siblingGuardianContact || siblingGuardianName);
    if (hasAnchorGuardian && hasSiblingGuardian) {
      const contactMatch = anchorGuardianContact && siblingGuardianContact && anchorGuardianContact === siblingGuardianContact;
      const nameMatch = anchorGuardianName && siblingGuardianName && anchorGuardianName === siblingGuardianName;
      if (!contactMatch && !nameMatch) continue;
    }

    const siblingAccount = await ensureParentPortalAccount(tenantId, siblingPk);
    await linkParentAccountsInFamily(tenantId, anchorAccountId, Number(siblingAccount.id));
  }
}

async function issueParentToken(accountId: number, studentPk: number, tenantId: number) {
  return jwt.sign(
    { parentAccountId: accountId, studentId: studentPk, tenantId, role: 'parent' },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: parentJwtExpiresIn() }
  );
}

async function buildLinkedAccountsPayload(tenantId: number, accountId: number, studentPk: number) {
  await syncFamilyFromStudentSiblingRecords(tenantId, studentPk, accountId);

  const accountRow = await query(
    'SELECT family_group_id FROM parent_portal_accounts WHERE id = $1 AND tenant_id = $2',
    [accountId, tenantId]
  );
  const groupId = accountRow.rows[0]?.family_group_id;
  if (!groupId) return [];

  const members = await query(
    `SELECT pa.id AS account_id, pa.is_active, s.id AS student_pk
     FROM parent_portal_accounts pa
     JOIN students s ON s.id = pa.student_id AND s.tenant_id = pa.tenant_id
     WHERE pa.tenant_id = $1 AND pa.family_group_id = $2 AND pa.is_active = true
     ORDER BY s.first_name, s.last_name, s.id`,
    [tenantId, groupId]
  );

  const linkedAccounts: Array<{ student: Record<string, unknown> }> = [];
  for (const member of members.rows) {
    const profile = await fetchParentStudentProfile(tenantId, Number(member.student_pk));
    if (!profile || Number(profile.tenant_id) !== tenantId) continue;
    linkedAccounts.push({ student: profile });
  }
  return linkedAccounts;
}

async function fetchFamilyLinkedStudentsForAdmin(tenantId: number, accountId: number, anchorStudentPk: number) {
  const accountRow = await query(
    'SELECT family_group_id FROM parent_portal_accounts WHERE id = $1 AND tenant_id = $2',
    [accountId, tenantId]
  );
  const groupId = accountRow.rows[0]?.family_group_id;
  if (!groupId) return [];

  const rows = await query(
    `SELECT s.id AS student_id,
            s.first_name,
            s.last_name,
            s.student_id AS admission_number,
            s.admission_number AS admission_number_legacy,
            pa.id AS account_id
     FROM parent_portal_accounts pa
     JOIN students s ON s.id = pa.student_id AND s.tenant_id = pa.tenant_id
     WHERE pa.tenant_id = $1 AND pa.family_group_id = $2 AND s.id != $3
     ORDER BY s.first_name, s.last_name, s.id`,
    [tenantId, groupId, anchorStudentPk]
  );

  return rows.rows.map((row) => ({
    accountId: row.account_id,
    studentId: row.student_id,
    admissionNumber: row.admission_number || row.admission_number_legacy,
    studentName: `${row.first_name} ${row.last_name}`.trim(),
  }));
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
        AND COALESCE(TRIM(s.student_id), '') <> ''
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

    const studentPk = await resolveStudentInternalId(tenantId, req.body?.studentId);
    if (!studentPk) {
      return res.status(400).json({ error: 'studentId is required and must match a student in this school' });
    }

    const studentResult = await query(
      `SELECT id, student_id, admission_number, first_name, last_name
       FROM students WHERE id = $1 AND tenant_id = $2`,
      [studentPk, tenantId]
    );
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found for this tenant' });
    }

    const existing = await query(
      'SELECT id FROM parent_portal_accounts WHERE tenant_id = $1 AND student_id = $2',
      [tenantId, studentPk]
    );
    if (existing.rows.length > 0) {
      const linkToAccountId = Number(req.body?.linkToAccountId);
      if (Number.isInteger(linkToAccountId) && linkToAccountId > 0) {
        await linkParentAccountsInFamily(tenantId, linkToAccountId, Number(existing.rows[0].id));
        return res.json({
          success: true,
          accountId: existing.rows[0].id,
          message: 'Student already had a parent account — linked to this family.',
        });
      }
      return res.status(400).json({
        error: 'This student already has a parent account. Use Link Sibling on the main child account — you can link as many siblings as you need.',
      });
    }

    const studentRow = studentResult.rows[0];
    const loginId = defaultParentPortalPassword(studentRow);
    if (!loginId) {
      return res.status(400).json({ error: 'Student has no portal login ID configured. Set Student ID on the student record first.' });
    }

    const customPassword = String(req.body?.password || '').trim();
    if (customPassword && customPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const passwordToSet = customPassword || loginId;
    const mustChangePassword = !customPassword;

    const passwordHash = await bcrypt.hash(passwordToSet, 10);
    const inserted = await query(
      `INSERT INTO parent_portal_accounts (tenant_id, student_id, password_hash, must_change_password)
       VALUES ($1, $2, $3, $4)
       RETURNING id, is_active, must_change_password, last_login`,
      [tenantId, studentPk, passwordHash, mustChangePassword]
    );

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      action: 'create_parent_account',
      entityType: 'parent_portal_account',
      entityId: inserted.rows[0].id,
      summary: `Admin created parent portal account for ${studentRow.first_name} ${studentRow.last_name}`,
      details: {
        studentId: studentPk,
        studentPortalId: loginId,
        customPassword: !!customPassword,
      },
    });

    return res.status(201).json({
      success: true,
      accountId: inserted.rows[0].id,
      credentials: {
        studentPortalId: loginId,
        defaultPassword: passwordToSet,
        mustChangePassword,
        studentName: `${studentRow.first_name} ${studentRow.last_name}`.trim(),
      },
    });
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
    const linkedStudents = await fetchFamilyLinkedStudentsForAdmin(
      tenantId,
      Number(row.account_id),
      Number(row.student_id)
    );
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
      linkedStudents,
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
    const { isActive, mustChangePassword } = req.body || {};
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
        after: { isActive, mustChangePassword },
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Admin parent account update error:', error);
    return res.status(500).json({ error: 'Failed to update parent account' });
  }
});

adminRouter.post('/accounts/:accountId/link-sibling', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(String(req.query.tenantId || req.user?.tenantId), 10);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const accountId = Number(req.params.accountId);
    const studentLoginIds = parseStudentLoginIds(req.body);
    if (studentLoginIds.length === 0) {
      return res.status(400).json({ error: 'Enter at least one sibling studentLoginId' });
    }

    const accountResult = await query(
      `SELECT pa.id, pa.student_id, s.first_name, s.last_name
       FROM parent_portal_accounts pa
       JOIN students s ON s.id = pa.student_id AND s.tenant_id = pa.tenant_id
       WHERE pa.id = $1 AND pa.tenant_id = $2`,
      [accountId, tenantId]
    );
    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Parent account not found' });
    }

    const anchor = accountResult.rows[0];
    const results: LinkSiblingResult[] = [];
    for (const studentLoginId of studentLoginIds) {
      results.push(
        await linkSiblingStudentToAccount(
          tenantId,
          accountId,
          Number(anchor.student_id),
          studentLoginId
        )
      );
    }

    const linkedStudents = await fetchFamilyLinkedStudentsForAdmin(
      tenantId,
      accountId,
      Number(anchor.student_id)
    );

    const linkedCount = results.filter((result) => result.status === 'linked').length;
    const alreadyLinkedCount = results.filter((result) => result.status === 'already_linked').length;
    const notFound = results.filter((result) => result.status === 'not_found');
    const selfLinks = results.filter((result) => result.status === 'self');

    if (linkedCount > 0) {
      await writeAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'link_parent_sibling_account',
        entityType: 'parent_portal_account',
        entityId: accountId,
        summary: `Admin linked ${linkedCount} sibling account(s) to parent family`,
        details: {
          anchorStudentId: anchor.student_id,
          linkedStudentLoginIds: results
            .filter((result) => result.status === 'linked')
            .map((result) => result.studentLoginId),
        },
      });
    }

    const parts: string[] = [];
    if (linkedCount > 0) parts.push(`${linkedCount} sibling(s) linked`);
    if (alreadyLinkedCount > 0) parts.push(`${alreadyLinkedCount} already linked`);
    if (notFound.length > 0) parts.push(`${notFound.length} not found`);
    if (selfLinks.length > 0) parts.push(`${selfLinks.length} skipped (same student)`);

    return res.json({
      success: linkedCount > 0 || alreadyLinkedCount > 0,
      message: parts.length > 0
        ? `${parts.join(', ')}. Parent can switch between all linked children without logging in again.`
        : 'No siblings were linked. Check the student IDs and try again.',
      linkedStudents,
      results,
    });
  } catch (error) {
    console.error('Admin link sibling error:', error);
    return res.status(500).json({ error: 'Failed to link sibling student' });
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
      `SELECT pa.id, pa.is_active, s.student_id, s.admission_number
       FROM parent_portal_accounts pa
       JOIN students s ON s.id = pa.student_id AND s.tenant_id = pa.tenant_id
       WHERE pa.id = $1 AND pa.tenant_id = $2`,
      [accountId, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parent account not found' });
    }

    const row = result.rows[0];
    const defaultPassword = defaultParentPortalPassword(row);
    if (!defaultPassword) {
      return res.status(400).json({ error: 'Student has no portal login ID configured' });
    }
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
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
      details: { accountId, studentLoginId: defaultPassword },
    });

    return res.json({
      success: true,
      message: 'Password has been reset to the student portal ID.',
      credentials: {
        studentPortalId: defaultPassword,
        defaultPassword,
      },
    });
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
       JOIN grade_assignments a ON g.assignment_id = a.id AND a.tenant_id = g.tenant_id
       JOIN classes c ON a.class_id = c.id AND c.tenant_id = g.tenant_id
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
       LEFT JOIN classes c ON s.class_assigned_id = c.id AND c.tenant_id = s.tenant_id
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

    const archivedRow = await getArchivedReportForStudentTerm(
      tenantId,
      studentId,
      currentTerm,
      currentYear
    );
    if (archivedRow) {
      return res.json({
        report: buildParentReportFromArchive(archivedRow, studentId),
      });
    }

    const { teacherRemark, headmasterRemark } = await loadStudentTermRemarks(
      tenantId,
      classId,
      studentId,
      currentTerm,
      currentYear
    );

    // Get all assignments for this class (current term only)
    const assignmentsRes = await query(
      `SELECT id, subject, name, assignment_type, max_score
       FROM grade_assignments WHERE tenant_id = $1 AND class_id = $2
         AND term = $3 AND academic_year = $4
       ORDER BY subject, name`,
      [tenantId, classId, currentTerm, currentYear]
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
      const subjectScores: Record<string, { score: number; maxScore: number; classScore: number; examScore: number }> = {};
      let grandTotal = 0;
      let grandMax = 0;

      for (const subj of subjects) {
        const subjAssignments = assignments.filter((a: any) => a.subject === subj);
        let classScoreSum = 0;
        let classMaxSum = 0;
        let examScoreSum = 0;
        let examMaxSum = 0;

        for (const a of subjAssignments) {
          const score = gradeMap[`${s.id}-${a.id}`] ?? 0;
          const isExam = a.assignment_type.toLowerCase() === 'exam' || a.name.toLowerCase().includes('exam');
          if (isExam) {
            examScoreSum += score;
            examMaxSum += parseFloat(a.max_score);
          } else {
            classScoreSum += score;
            classMaxSum += parseFloat(a.max_score);
          }
        }

        let classScoreVal = 0;
        let examScoreVal = 0;

        if (classMaxSum > 0 && examMaxSum > 0) {
          classScoreVal = (classScoreSum / classMaxSum) * 40;
          examScoreVal = (examScoreSum / examMaxSum) * 60;
        } else if (classMaxSum > 0) {
          const pct = classScoreSum / classMaxSum;
          classScoreVal = pct * 40;
          examScoreVal = pct * 60;
        } else if (examMaxSum > 0) {
          const pct = examScoreSum / examMaxSum;
          classScoreVal = pct * 40;
          examScoreVal = pct * 60;
        }

        const totalScore = classScoreVal + examScoreVal;

        subjectScores[subj] = {
          score: Math.round(totalScore * 10) / 10,
          maxScore: 100,
          classScore: Math.round(classScoreVal * 10) / 10,
          examScore: Math.round(examScoreVal * 10) / 10,
        };
        grandTotal += totalScore;
        grandMax += 100;
      }

      return {
        studentId: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        admissionNumber: s.admission_number,
        passportPhotoUrl: s.passport_photo_url || null,
        subjectScores,
        grandTotal: Math.round(grandTotal * 10) / 10,
        grandMax: Math.round(grandMax * 10) / 10,
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
        teacherRemark,
        headmasterRemark,
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

    const settingsRow = await query(
      'SELECT current_term, current_year, school_name FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    const currentTerm = settingsRow.rows[0]?.current_term || '';
    const currentYear = settingsRow.rows[0]?.current_year || '';
    const schoolName = settingsRow.rows[0]?.school_name || '';

    const studentRow = await query(
      `SELECT s.first_name, s.last_name, s.student_id AS admission_number,
              s.is_beneficiary, s.beneficiary_type, s.discount_type, s.discount_value,
              c.class_name, c.id AS class_id
       FROM students s
       LEFT JOIN classes c ON s.class_assigned_id = c.id AND c.tenant_id = s.tenant_id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [studentId, tenantId]
    );
    if (studentRow.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const student = studentRow.rows[0];

    await ensureTenantLedgerSynced(tenantId);

    const { ledgerTermId } = await resolveActiveLedgerTerm(query, tenantId);
    const balance = await getStudentLiveFeeBreakdown(null, tenantId, studentId, ledgerTermId);
    if (!balance) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const currentTermLabel =
      balance.currentTermName ||
      (currentTerm && currentYear ? `${currentTerm} ${currentYear}`.trim() : currentTerm);

    const currentTermRow = balance.termRows.find((r) => r.isActiveTerm) ?? null;
    const termFeeLines = await buildCurrentTermFeeLines(
      tenantId,
      student.class_id ? Number(student.class_id) : null,
      currentTermRow?.termId ?? ledgerTermId,
      balance.currentTermFee,
      student
    );

    const portalStatus = mapParentPortalStatus(balance);

    const paymentsRow = await query(
      `SELECT
         p.id,
         COALESCE(p.amount_paid, p.amount) AS amount_paid,
         p.amount,
         p.payment_date,
         p.payment_method,
         p.receipt_number,
         p.receipt_number AS reference_number,
         p.notes,
         p.term,
         p.receipt_snapshot,
         p.corrects_payment_id,
         orig.receipt_number AS original_receipt_number,
         p.corrected_at AS receipt_updated_at,
         COALESCE(pa.account_name, p.payment_method, 'Cash') AS method_label
       FROM payments p
       LEFT JOIN payment_accounts pa ON pa.id = p.payment_account_id
       LEFT JOIN payments orig ON orig.id = p.corrects_payment_id
       WHERE p.tenant_id = $1 AND p.student_id = $2 AND COALESCE(p.is_voided, false) = false
       ORDER BY p.payment_date DESC, p.id DESC`,
      [tenantId, studentId]
    );

    const payments = paymentsRow.rows.map((p: Record<string, unknown>) => {
      const isCorrected = !!p.corrects_payment_id;
      return {
        id: Number(p.id),
        receipt_number: p.receipt_number ? String(p.receipt_number) : null,
        reference_number: p.reference_number ? String(p.reference_number) : null,
        payment_date: p.payment_date,
        amount_paid: roundMoney(parseFloat(String(p.amount_paid)) || 0),
        amount: roundMoney(parseFloat(String(p.amount)) || parseFloat(String(p.amount_paid)) || 0),
        payment_method: String(p.method_label || p.payment_method || 'Cash'),
        term: String(p.term || '—'),
        notes: p.notes ? String(p.notes) : null,
        receipt_snapshot: p.receipt_snapshot ?? null,
        corrects_payment_id: p.corrects_payment_id != null ? Number(p.corrects_payment_id) : null,
        receipt_updated_at: p.receipt_updated_at ?? null,
        status: isCorrected ? 'corrected' : 'active',
        replacesReceiptNumber: p.original_receipt_number ? String(p.original_receipt_number) : null,
      };
    });

    const termPayments = payments.filter((p) => {
      const paymentTerm = String(p.term || '').trim().toLowerCase();
      const activeTerm = String(currentTermLabel || '').trim().toLowerCase();
      if (!paymentTerm || paymentTerm === '—') return true;
      if (!activeTerm) return true;
      return (
        paymentTerm === activeTerm ||
        paymentTerm.includes(activeTerm) ||
        activeTerm.includes(paymentTerm)
      );
    });

    res.json({
      schoolName,
      currentTerm: currentTermLabel,
      currentTermLabel,
      currentYear,
      student,
      liveBreakdown: balance,
      termFee: balance.currentTermFee,
      arrears: balance.totalArrears,
      totalDue: balance.totalDue,
      totalPaid: balance.totalPaid,
      outstanding: balance.outstanding,
      credit: balance.credit,
      balance: balance.outstanding,
      discountAmount: termFeeLines.discountAmount,
      status: portalStatus,
      feeBreakdown: {
        termLabel: currentTermLabel,
        termFeeLines: termFeeLines.lines,
        arrearLines: balance.arrearLines,
        subtotal: termFeeLines.subtotal,
        discountAmount: termFeeLines.discountAmount,
        termFee: balance.currentTermFee,
        totalArrears: balance.totalArrears,
        totalDue: balance.totalDue,
        totalPaid: balance.totalPaid,
        outstanding: balance.outstanding,
        credit: balance.credit,
      },
      payments,
      termPayments,
    });
  } catch (error) {
    console.error('Parent finance error:', error);
    res.status(500).json({ error: 'Failed to fetch finance info' });
  }
});

// ── GET /api/parent/finance-statement ─────────────────────────────────────────
router.get('/finance-statement', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { studentId, tenantId } = req.parent!;

    const statement = await buildStudentFinanceStatement(tenantId, studentId, {
      variant: 'parent_portal',
      generatedByName: null,
      generatedByRole: null,
    });
    if (!statement) {
      return res.status(404).json({ error: 'Student not found' });
    }

    await writeAuditLog({
      tenantId,
      userId: null,
      userRole: 'parent',
      action: 'FINANCE_STATEMENT_GENERATED',
      entityType: 'STUDENT',
      entityId: studentId,
      module: 'finance',
      status: 'success',
      summary: `Parent portal finance statement for ${statement.header.studentName} (${statement.header.studentId})`,
      details: {
        studentName: statement.header.studentName,
        studentId: statement.header.studentId,
        generatedBy: 'Parent Portal',
        generatedByRole: 'parent',
        generatedAt: statement.header.dateGenerated,
        generatedVia: 'parent_portal',
      },
    });

    return res.json({ statement });
  } catch (error) {
    console.error('Parent finance statement error:', error);
    res.status(500).json({ error: 'Failed to fetch finance statement' });
  }
});

// ── GET /api/parent/invoices ─────────────────────────────────────────────────
router.get('/invoices', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { studentId, tenantId } = req.parent!;
    const termId = req.query.termId ? Number(req.query.termId) : null;

    const all = await listInvoices(tenantId, {
      termId: termId && !Number.isNaN(termId) ? termId : null,
      limit: 100,
      offset: 0,
    });
    const items = all.items.filter((inv) => inv.studentId === studentId);
    res.json({ items, total: items.length });
  } catch (error) {
    console.error('Parent invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.get('/invoices/:id/pdf-data', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { studentId, tenantId } = req.parent!;
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid invoice id' });

    const invoice = await getInvoiceById(tenantId, id);
    if (!invoice || invoice.studentId !== studentId) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const payload = await getInvoicePdfPayload(tenantId, id);
    if (!payload) return res.status(404).json({ error: 'Invoice not found' });
    res.json(payload);
  } catch (error) {
    console.error('Parent invoice PDF data error:', error);
    res.status(500).json({ error: 'Failed to load invoice' });
  }
});

// ── GET /api/parent/admission-letters ────────────────────────────────────────

router.get('/admission-letters', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { studentId, tenantId } = req.parent!;
    const letters = await listAdmissionLetters(tenantId, studentId);
    res.json(letters);
  } catch (error) {
    console.error('Parent admission letters error:', error);
    res.status(500).json({ error: 'Failed to fetch admission letters' });
  }
});

router.get('/admission-letters/:letterId/download', authenticateParent, async (req: ParentRequest, res) => {
  try {
    const { studentId, tenantId } = req.parent!;
    const { letterId } = req.params;
    const letter = await getAdmissionLetterPdf(tenantId, studentId, parseInt(letterId, 10));
    if (!letter) return res.status(404).json({ error: 'Admission letter not found' });
    const content = await enrichAdmissionLetterContent(
      tenantId,
      studentId,
      letter.letter_content as AdmissionLetterContent
    );
    res.json(content);
  } catch (error) {
    console.error('Parent admission letter download error:', error);
    res.status(500).json({ error: 'Failed to download admission letter' });
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
       JOIN classes c ON a.class_id = c.id AND c.tenant_id = a.tenant_id
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
