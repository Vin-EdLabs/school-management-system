import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db/connection.js';
import {
  authenticatePartner,
  signPartnerToken,
  rejectIfSuspended,
  PartnerAuthRequest,
} from '../middleware/authenticatePartner.js';
import { ensureMonthlyCommissions } from '../services/partnerService.js';
import { logPartnerAuthEvent } from '../services/partnerAuthAuditService.js';
import { notifyAdminNewPartnerApplication, sendPartnerEmail } from '../services/partnerEmailService.js';
import { getVapidPublicKey } from '../services/webPushService.js';
import { resolvePartnerPortalDirectUrl } from '../utils/publicAppUrl.js';
import { maskEmailAddress } from '../utils/maskEmail.js';
import { notifyPartner } from '../services/partnerNotifyService.js';
import { emitPartnerSupportMessage } from '../services/partnerSupportSocketService.js';

const router = express.Router();

const PARTNER_MIN_PASSWORD = 6;

/** Last 9 digits — reliable match for Ghana numbers in any format. */
function ghanaPhoneCore(input: string): string | null {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

async function findPartnerByLoginIdentifier(identifier: string) {
  const trimmed = String(identifier || '').trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    const byEmail = await query(
      `SELECT * FROM partners WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [trimmed]
    );
    return byEmail.rows[0] || null;
  }

  const core = ghanaPhoneCore(trimmed);
  if (!core) return null;

  const byPhone = await query(
    `SELECT * FROM partners
      WHERE RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 9) = $1
         OR RIGHT(regexp_replace(COALESCE(whatsapp, ''), '\\D', '', 'g'), 9) = $1
      LIMIT 1`,
    [core]
  );
  return byPhone.rows[0] || null;
}

async function findValidPartnerResetToken(token: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const tokenRes = await query(
    `SELECT t.id, t.partner_id, p.email, p.first_name
       FROM partner_password_reset_tokens t
       JOIN partners p ON p.id = t.partner_id
      WHERE t.token_hash = $1
        AND t.used_at IS NULL
        AND t.expires_at > NOW()
      LIMIT 1`,
    [tokenHash]
  );
  return tokenRes.rows[0] as
    | { id: number; partner_id: number; email: string; first_name: string }
    | undefined;
}

const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
  'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
  'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
];
const MOMO_NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'];
const SCHOOLS_TARGETS = ['1-5', '6-15', '16-30', '30+'];
const GENDERS = ['male', 'female'];
const HEARD_FROM = ['social_media', 'friends', 'other'];

function publicPartner(row: any) {
  return {
    id: Number(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    region: row.region,
    town: row.town || null,
    occupation: row.occupation,
    momoNumber: row.momo_number,
    momoNetwork: row.momo_network,
    schoolsTarget: row.schools_target,
    status: row.status,
    partnerId: row.partner_id,
    tier: row.tier,
    profilePhotoUrl: row.profile_photo_url || null,
    suspensionNote: row.suspension_note || null,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// POST /api/partners/register — public application + auto-login
// ---------------------------------------------------------------------------
router.post('/register', async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, whatsapp, password,
      region, town, occupation, momoNumber, momoNetwork, schoolsTarget, motivation,
      gender, heardFrom,
    } = req.body || {};

    const errors: Record<string, string> = {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();

    if (!String(firstName || '').trim()) errors.firstName = 'First name is required';
    if (!String(lastName || '').trim()) errors.lastName = 'Last name is required';
    if (!GENDERS.includes(String(gender || ''))) errors.gender = 'Select Male or Female';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) errors.email = 'Enter a valid email address';
    if (cleanPhone.replace(/\D/g, '').length < 9) errors.phone = 'Enter a valid phone number';
    if (!password || String(password).length < PARTNER_MIN_PASSWORD) {
      errors.password = `Password must be at least ${PARTNER_MIN_PASSWORD} characters`;
    }
    if (!GHANA_REGIONS.includes(String(region || ''))) errors.region = 'Select your region';
    if (!String(town || '').trim()) errors.town = 'Enter your town or city';
    if (!String(momoNumber || '').trim()) errors.momoNumber = 'MoMo number is required';
    if (!MOMO_NETWORKS.includes(String(momoNetwork || ''))) errors.momoNetwork = 'Select your MoMo network';
    if (schoolsTarget && !SCHOOLS_TARGETS.includes(String(schoolsTarget))) {
      errors.schoolsTarget = 'Select a valid range';
    }
    if (!HEARD_FROM.includes(String(heardFrom || ''))) {
      errors.heardFrom = 'Tell us how you heard about the Partner Program';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Please fix the highlighted fields', fields: errors });
    }

    const existing = await query('SELECT id FROM partners WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'An application with this email already exists',
        fields: { email: 'This email is already registered. Try logging in instead.' },
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const inserted = await query(
      `INSERT INTO partners
         (first_name, last_name, email, phone, whatsapp, password_hash, region, town,
          occupation, momo_number, momo_network, schools_target, motivation, gender, heard_from, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending')
       RETURNING *`,
      [
        String(firstName).trim(), String(lastName).trim(), cleanEmail, cleanPhone,
        String(whatsapp || phone || '').trim() || null, passwordHash, String(region),
        String(town).trim(), String(occupation || '').trim() || null, String(momoNumber).trim(),
        String(momoNetwork), schoolsTarget ? String(schoolsTarget) : null,
        String(motivation || '').trim() || null,
        String(gender), String(heardFrom),
      ]
    );

    const partner = inserted.rows[0];
    sendPartnerEmail(partner, 'application_received', {}, undefined, req).catch(() => undefined);
    notifyAdminNewPartnerApplication(partner).catch(() => undefined);
    const token = signPartnerToken({ id: Number(partner.id), email: partner.email });
    void logPartnerAuthEvent(Number(partner.id), 'login', req);
    return res.status(201).json({ token, partner: publicPartner(partner) });
  } catch (error) {
    console.error('Partner register error:', error);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/partners/regions — searchable Ghana regions (public)
// ---------------------------------------------------------------------------
router.get('/regions', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const regions = q
    ? GHANA_REGIONS.filter((r) => r.toLowerCase().includes(q))
    : [...GHANA_REGIONS];
  return res.json({ regions });
});

// ---------------------------------------------------------------------------
// POST /api/partners/forgot-password — email reset link
// ---------------------------------------------------------------------------
router.post('/forgot-password', async (req, res) => {
  try {
    const raw = String(req.body?.phone || req.body?.identifier || '').trim();
    if (!raw) {
      return res.status(400).json({ error: 'Enter the phone number on your partner account' });
    }
    if (raw.includes('@')) {
      return res.status(400).json({ error: 'Enter your phone number only — not your email' });
    }
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 9) {
      return res.status(400).json({ error: 'Enter a valid phone number (at least 9 digits)' });
    }

    const partner = await findPartnerByLoginIdentifier(raw);

    let maskedEmail: string | null = null;
    if (partner) {
      const accountEmail = String(partner.email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)) {
        return res.status(400).json({
          error: 'This account has no valid email on file. Contact ScholarNerve support for help.',
        });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await query(
        `INSERT INTO partner_password_reset_tokens (partner_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [partner.id, tokenHash, expiresAt]
      );
      const resetPath = `/reset-password?token=${encodeURIComponent(token)}`;
      const resetLink = resolvePartnerPortalDirectUrl(resetPath, req);
      const sent = await sendPartnerEmail(partner, 'password_reset', { resetLink }, undefined, req);
      if (!sent) {
        console.error('[partner] Password reset email failed for partner', partner.id, accountEmail);
        return res.status(503).json({
          error: 'Could not send the reset email right now. Check your connection and try again in a moment.',
        });
      }
      maskedEmail = maskEmailAddress(accountEmail);
    }

    return res.json({
      success: true,
      maskedEmail,
      message: maskedEmail
        ? `We sent a password reset link to ${maskedEmail}.`
        : 'If an account exists with those details, we sent a password reset link to the email on your account.',
    });
  } catch (error) {
    console.error('Partner forgot password error:', error);
    return res.status(500).json({ error: 'Could not process reset request' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/partners/reset-password/preview — account email tied to reset token
// ---------------------------------------------------------------------------
router.get('/reset-password/preview', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'Reset token is required' });
    }
    const row = await findValidPartnerResetToken(token);
    if (!row) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired' });
    }
    return res.json({
      maskedEmail: maskEmailAddress(String(row.email)),
      firstName: String(row.first_name || ''),
    });
  } catch (error) {
    console.error('Partner reset preview error:', error);
    return res.status(500).json({ error: 'Could not validate reset link' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/partners/reset-password — set new password from email link
// ---------------------------------------------------------------------------
router.post('/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }
    if (newPassword.length < PARTNER_MIN_PASSWORD) {
      return res.status(400).json({
        error: `Password must be at least ${PARTNER_MIN_PASSWORD} characters`,
      });
    }

    const row = await findValidPartnerResetToken(token);
    if (!row) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE partners SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      passwordHash,
      row.partner_id,
    ]);
    await query('UPDATE partner_password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);

    return res.json({
      success: true,
      email: String(row.email),
      maskedEmail: maskEmailAddress(String(row.email)),
      message: 'Password updated. You can sign in with your new password.',
    });
  } catch (error) {
    console.error('Partner reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/partners/login — email OR phone + password
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const identifier = String(req.body?.identifier || req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Enter your email/phone and password' });
    }

    const partner = await findPartnerByLoginIdentifier(identifier);
    if (!partner) {
      return res.status(401).json({ error: 'No partner account found with those details' });
    }
    const valid = await bcrypt.compare(password, String(partner.password_hash || ''));
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }
    if (partner.status === 'rejected') {
      return res.status(403).json({ error: 'This partner application was not approved' });
    }

    const token = signPartnerToken({ id: Number(partner.id), email: partner.email });
    void logPartnerAuthEvent(Number(partner.id), 'login', req);
    return res.json({ token, partner: publicPartner(partner) });
  } catch (error) {
    console.error('Partner login error:', error);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/partners/logout — stateless JWT; endpoint exists for symmetry
// ---------------------------------------------------------------------------
router.post('/logout', authenticatePartner, async (req: PartnerAuthRequest, res) => {
  void logPartnerAuthEvent(req.partner!.partnerId, 'logout', req);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /api/partners/me — profile + headline stats
// ---------------------------------------------------------------------------
router.get('/me', authenticatePartner, async (req: PartnerAuthRequest, res) => {
  try {
    const id = req.partner!.partnerId;
    const partnerRes = await query('SELECT * FROM partners WHERE id = $1', [id]);
    if (partnerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Non-blocking — commission rows are ensured on reads; don't slow session load
    void ensureMonthlyCommissions(id).catch((err) => {
      console.error('ensureMonthlyCommissions error:', err);
    });

    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.getMonth() + 1;
    const lastMonthYear = lastMonthDate.getFullYear();

    const [leadStats, commStats, unreadRes, unreadSupportRes, recentCommissions, recentLeads, recentNotifications] =
      await Promise.all([
        query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status = 'converted')::int AS converted
             FROM partner_school_leads WHERE partner_id = $1`,
          [id]
        ),
        query(
          `SELECT
             COALESCE(SUM(commission_amount) FILTER (WHERE month = $2 AND year = $3), 0) AS this_month,
             COALESCE(SUM(commission_amount) FILTER (WHERE month = $4 AND year = $5), 0) AS last_month,
             COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0) AS total_paid,
             COALESCE(SUM(commission_amount), 0) AS total_all,
             COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0) AS pending
           FROM partner_commissions WHERE partner_id = $1`,
          [id, now.getMonth() + 1, now.getFullYear(), lastMonth, lastMonthYear]
        ),
        query(
          `SELECT COUNT(*)::int AS unread FROM partner_notifications
            WHERE partner_id = $1 AND read_at IS NULL`,
          [id]
        ),
        query(
          `SELECT COUNT(*)::int AS unread FROM partner_support_messages
            WHERE partner_id = $1 AND is_from_superadmin = true AND read_at IS NULL AND is_deleted = false`,
          [id]
        ),
        query(
          `SELECT c.id, c.commission_amount, c.status, c.paid_at, c.month, c.year
             FROM partner_commissions c
            WHERE c.partner_id = $1 AND c.status = 'paid'
            ORDER BY c.paid_at DESC NULLS LAST, c.year DESC, c.month DESC
            LIMIT 3`,
          [id]
        ),
        query(
          `SELECT id, school_name, created_at FROM partner_school_leads
            WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 2`,
          [id]
        ),
        query(
          `SELECT id, title, body, created_at FROM partner_notifications
            WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 2`,
          [id]
        ),
      ]);

    const activity: Array<{
      id: string;
      kind: 'commission' | 'lead' | 'notification';
      title: string;
      subtitle: string;
      right: string;
      tone: 'green' | 'orange' | 'blue';
      createdAt: string;
    }> = [];

    for (const c of recentCommissions.rows) {
      activity.push({
        id: `c-${c.id}`,
        kind: 'commission',
        title: 'Commission Received',
        subtitle: '',
        right: String(Number(c.commission_amount)),
        tone: 'green',
        createdAt: c.paid_at || `${c.year}-${String(c.month).padStart(2, '0')}-01`,
      });
    }
    for (const l of recentLeads.rows) {
      activity.push({
        id: `l-${l.id}`,
        kind: 'lead',
        title: 'School Referred',
        subtitle: l.school_name,
        right: l.school_name,
        tone: 'orange',
        createdAt: l.created_at,
      });
    }
    for (const n of recentNotifications.rows) {
      activity.push({
        id: `n-${n.id}`,
        kind: 'notification',
        title: n.title || 'New Notification',
        subtitle: n.body || '',
        right: 'ScholarNerve',
        tone: 'blue',
        createdAt: n.created_at,
      });
    }

    activity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({
      partner: publicPartner(partnerRes.rows[0]),
      stats: {
        totalSchools: Number(leadStats.rows[0].total),
        activeSchools: Number(leadStats.rows[0].converted),
        thisMonthEarnings: Number(commStats.rows[0].this_month),
        lastMonthEarnings: Number(commStats.rows[0].last_month),
        totalEarned: Number(commStats.rows[0].total_paid),
        totalAll: Number(commStats.rows[0].total_all),
        pendingPayout: Number(commStats.rows[0].pending),
        unreadNotifications: Number(unreadRes.rows[0].unread),
        unreadSupportMessages: Number(unreadSupportRes.rows[0].unread),
      },
      recentActivity: activity.slice(0, 5),
    });
  } catch (error) {
    console.error('Partner me error:', error);
    return res.status(500).json({ error: 'Failed to load your account' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/partners/profile — editable contact/payout fields + password change
// ---------------------------------------------------------------------------
router.put('/profile', authenticatePartner, rejectIfSuspended, async (req: PartnerAuthRequest, res) => {
  try {
    const id = req.partner!.partnerId;
    const {
      whatsapp, momoNumber, momoNetwork, email, region, town,
      currentPassword, newPassword, profilePhotoUrl,
    } = req.body || {};

    if (momoNetwork && !MOMO_NETWORKS.includes(String(momoNetwork))) {
      return res.status(400).json({ error: 'Select a valid MoMo network' });
    }
    if (region !== undefined && !GHANA_REGIONS.includes(String(region))) {
      return res.status(400).json({ error: 'Select a valid region' });
    }

    const needsPasswordCheck = Boolean(newPassword || email !== undefined);
    if (needsPasswordCheck) {
      const current = await query('SELECT password_hash, email FROM partners WHERE id = $1', [id]);
      const ok = await bcrypt.compare(
        String(currentPassword || ''),
        String(current.rows[0]?.password_hash || '')
      );
      if (!ok) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Enter a valid email address' });
      }
      const dup = await query(
        'SELECT id FROM partners WHERE LOWER(email) = $1 AND id <> $2',
        [cleanEmail, id]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: 'That email is already used by another account' });
      }
      await query('UPDATE partners SET email = $1, updated_at = NOW() WHERE id = $2', [cleanEmail, id]);
    }

    if (newPassword) {
      if (String(newPassword).length < PARTNER_MIN_PASSWORD) {
        return res.status(400).json({
          error: `New password must be at least ${PARTNER_MIN_PASSWORD} characters`,
        });
      }
      const newHash = await bcrypt.hash(String(newPassword), 10);
      await query('UPDATE partners SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
        newHash, id,
      ]);
    }

    if (profilePhotoUrl !== undefined) {
      const photo = profilePhotoUrl === null || profilePhotoUrl === '' ? null : String(profilePhotoUrl);
      if (photo && photo.length > 6_000_000) {
        return res.status(400).json({ error: 'Photo is too large. Use a smaller image.' });
      }
      if (photo && !photo.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Invalid photo format' });
      }
    }

    const updated = await query(
      `UPDATE partners SET
         whatsapp = COALESCE($1, whatsapp),
         momo_number = COALESCE($2, momo_number),
         momo_network = COALESCE($3, momo_network),
         region = COALESCE($4, region),
         town = COALESCE($5, town),
         profile_photo_url = CASE WHEN $6::boolean THEN $7 ELSE profile_photo_url END,
         updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        whatsapp !== undefined ? String(whatsapp).trim() : null,
        momoNumber !== undefined ? String(momoNumber).trim() : null,
        momoNetwork !== undefined ? String(momoNetwork) : null,
        region !== undefined ? String(region).trim() : null,
        town !== undefined ? (String(town).trim() || null) : null,
        profilePhotoUrl !== undefined,
        profilePhotoUrl === null || profilePhotoUrl === '' ? null : String(profilePhotoUrl),
        id,
      ]
    );
    return res.json({ partner: publicPartner(updated.rows[0]) });
  } catch (error) {
    console.error('Partner profile update error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/partners/leads — refer a school
// ---------------------------------------------------------------------------
router.post('/leads', authenticatePartner, rejectIfSuspended, async (req: PartnerAuthRequest, res) => {
  try {
    if (req.partner!.status !== 'approved') {
      return res.status(403).json({ error: 'You can refer schools once your application is approved' });
    }
    const { schoolName, proprietorName, phone, region, studentCount, demoDate } = req.body || {};
    if (!String(schoolName || '').trim()) {
      return res.status(400).json({ error: 'School name is required' });
    }
    if (!String(demoDate || '').trim()) {
      return res.status(400).json({ error: 'Preferred demo date is required' });
    }

    const inserted = await query(
      `INSERT INTO partner_school_leads
         (partner_id, school_name, proprietor_name, phone, region, student_count, demo_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'new')
       RETURNING *`,
      [
        req.partner!.partnerId,
        String(schoolName).trim(),
        String(proprietorName || '').trim() || null,
        String(phone || '').trim() || null,
        String(region || '').trim() || null,
        String(studentCount || '').trim() || null,
        String(demoDate).trim(),
      ]
    );
    return res.status(201).json({ lead: inserted.rows[0] });
  } catch (error) {
    console.error('Partner lead create error:', error);
    return res.status(500).json({ error: 'Failed to submit referral' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/partners/leads — my referred schools with per-school commission
// ---------------------------------------------------------------------------
router.get('/leads', authenticatePartner, async (req: PartnerAuthRequest, res) => {
  try {
    const result = await query(
      `SELECT l.*,
              COALESCE((
                SELECT c.commission_amount FROM partner_commissions c
                 WHERE c.lead_id = l.id
                 ORDER BY c.year DESC, c.month DESC LIMIT 1
              ), 0) AS monthly_commission
         FROM partner_school_leads l
        WHERE l.partner_id = $1
        ORDER BY l.created_at DESC`,
      [req.partner!.partnerId]
    );
    return res.json({ leads: result.rows });
  } catch (error) {
    console.error('Partner leads error:', error);
    return res.status(500).json({ error: 'Failed to load your schools' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/partners/commissions — summary + records + payout history
// ---------------------------------------------------------------------------
router.get('/commissions', authenticatePartner, async (req: PartnerAuthRequest, res) => {
  try {
    const id = req.partner!.partnerId;
    void ensureMonthlyCommissions(id).catch((err) => {
      console.error('ensureMonthlyCommissions error:', err);
    });

    const now = new Date();
    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();
    const lastMonthDate = new Date(thisYear, now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.getMonth() + 1;
    const lastMonthYear = lastMonthDate.getFullYear();

    const [summaryRes, recordsRes] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(commission_amount) FILTER (WHERE month = $2 AND year = $3), 0) AS this_month,
           COALESCE(SUM(commission_amount) FILTER (WHERE month = $4 AND year = $5), 0) AS last_month,
           COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0) AS lifetime_paid,
           COALESCE(SUM(commission_amount), 0) AS lifetime_all,
           COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0) AS pending
         FROM partner_commissions WHERE partner_id = $1`,
        [id, thisMonth, thisYear, lastMonth, lastMonthYear]
      ),
      query(
        `SELECT c.*, l.school_name
           FROM partner_commissions c
           LEFT JOIN partner_school_leads l ON l.id = c.lead_id
          WHERE c.partner_id = $1
          ORDER BY c.year DESC, c.month DESC, c.id DESC`,
        [id]
      ),
    ]);

    const records = recordsRes.rows;
    return res.json({
      summary: {
        thisMonth: Number(summaryRes.rows[0].this_month),
        lastMonth: Number(summaryRes.rows[0].last_month),
        totalLifetime: Number(summaryRes.rows[0].lifetime_all),
        pendingPayout: Number(summaryRes.rows[0].pending),
      },
      records,
      payouts: records.filter((r: any) => r.status === 'paid'),
    });
  } catch (error) {
    console.error('Partner commissions error:', error);
    return res.status(500).json({ error: 'Failed to load commissions' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/partners/notifications
// ---------------------------------------------------------------------------
router.get('/notifications', authenticatePartner, async (req: PartnerAuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, title, body, read_at, created_at
         FROM partner_notifications
        WHERE partner_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [req.partner!.partnerId]
    );
    return res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Partner notifications error:', error);
    return res.status(500).json({ error: 'Failed to load notifications' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/partners/notifications/read-all
// ---------------------------------------------------------------------------
router.put('/notifications/read-all', authenticatePartner, async (req: PartnerAuthRequest, res) => {
  try {
    await query(
      `UPDATE partner_notifications SET read_at = NOW()
        WHERE partner_id = $1 AND read_at IS NULL`,
      [req.partner!.partnerId]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Partner notifications read-all error:', error);
    return res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/partners/notifications/:id/read
// ---------------------------------------------------------------------------
router.put('/notifications/:id/read', authenticatePartner, async (req: PartnerAuthRequest, res) => {
  try {
    await query(
      `UPDATE partner_notifications SET read_at = NOW()
        WHERE id = $1 AND partner_id = $2 AND read_at IS NULL`,
      [parseInt(req.params.id, 10), req.partner!.partnerId]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Partner notification read error:', error);
    return res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/partners/training-videos — with watched flags
// ---------------------------------------------------------------------------
router.get('/training-videos', authenticatePartner, async (req: PartnerAuthRequest, res) => {
  try {
    const result = await query(
      `SELECT v.id, v.youtube_url, v.title, v.description, v.created_at,
              (p.id IS NOT NULL) AS watched
         FROM partner_training_videos v
         LEFT JOIN partner_video_progress p
           ON p.video_id = v.id AND p.partner_id = $1
        ORDER BY v.created_at DESC`,
      [req.partner!.partnerId]
    );
    return res.json({ videos: result.rows });
  } catch (error) {
    console.error('Partner videos error:', error);
    return res.status(500).json({ error: 'Failed to load training videos' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/partners/training-videos/:id/watched
// ---------------------------------------------------------------------------
router.post('/training-videos/:id/watched', authenticatePartner, rejectIfSuspended, async (req: PartnerAuthRequest, res) => {
  try {
    await query(
      `INSERT INTO partner_video_progress (partner_id, video_id)
       VALUES ($1, $2)
       ON CONFLICT (partner_id, video_id) DO NOTHING`,
      [req.partner!.partnerId, parseInt(req.params.id, 10)]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Partner video watched error:', error);
    return res.status(500).json({ error: 'Failed to record progress' });
  }
});

// ---------------------------------------------------------------------------
// Web push — partner portal (same VAPID keys as parent/staff)
// ---------------------------------------------------------------------------
router.get('/push/public-key', authenticatePartner, async (_req: PartnerAuthRequest, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({ error: 'Push notifications are not configured yet' });
  }
  return res.json({ publicKey });
});

router.post('/push/subscribe', authenticatePartner, rejectIfSuspended, async (req: PartnerAuthRequest, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Invalid push subscription payload' });
    }

    await query(
      `INSERT INTO partner_push_subscriptions (partner_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (partner_id, endpoint)
       DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [req.partner!.partnerId, endpoint, p256dh, auth]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Partner push subscribe error:', error);
    return res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

router.post('/push/unsubscribe', authenticatePartner, rejectIfSuspended, async (req: PartnerAuthRequest, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });
    await query(
      'DELETE FROM partner_push_subscriptions WHERE partner_id = $1 AND endpoint = $2',
      [req.partner!.partnerId, endpoint]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Partner push unsubscribe error:', error);
    return res.status(500).json({ error: 'Failed to remove push subscription' });
  }
});

router.post('/push/fcm-token', authenticatePartner, rejectIfSuspended, async (req: PartnerAuthRequest, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token is required' });
    await query(
      `INSERT INTO partner_fcm_tokens (partner_id, token)
       VALUES ($1, $2)
       ON CONFLICT (partner_id, token)
       DO UPDATE SET updated_at = NOW()`,
      [req.partner!.partnerId, token]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Partner FCM token save error:', error);
    return res.status(500).json({ error: 'Failed to save FCM token' });
  }
});

router.post('/push/fcm-unsubscribe', authenticatePartner, rejectIfSuspended, async (req: PartnerAuthRequest, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) {
      await query('DELETE FROM partner_fcm_tokens WHERE partner_id = $1', [req.partner!.partnerId]);
    } else {
      await query(
        'DELETE FROM partner_fcm_tokens WHERE partner_id = $1 AND token = $2',
        [req.partner!.partnerId, token]
      );
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Partner FCM token remove error:', error);
    return res.status(500).json({ error: 'Failed to remove FCM token' });
  }
});

// ---------------------------------------------------------------------------
// Partner support chat — simple two-way messaging with ScholarNerve team
// ---------------------------------------------------------------------------
router.get('/support/messages', authenticatePartner, async (req: PartnerAuthRequest, res) => {
  try {
    const id = req.partner!.partnerId;
    const result = await query(
      `SELECT id, sender_role, sender_username, message, is_from_superadmin, read_at, created_at
         FROM partner_support_messages
        WHERE partner_id = $1 AND is_deleted = false
        ORDER BY created_at ASC
        LIMIT 500`,
      [id]
    );
    const unread = await query(
      `SELECT COUNT(*)::int AS c FROM partner_support_messages
        WHERE partner_id = $1 AND is_from_superadmin = true AND read_at IS NULL AND is_deleted = false`,
      [id]
    );
    return res.json({
      messages: result.rows,
      unreadCount: Number(unread.rows[0]?.c ?? 0),
    });
  } catch (error) {
    console.error('Partner support messages get error:', error);
    return res.status(500).json({ error: 'Failed to load support messages' });
  }
});

router.post('/support/messages', authenticatePartner, async (req: PartnerAuthRequest, res) => {
  try {
    const id = req.partner!.partnerId;
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Message is required' });
    if (message.length > 4000) return res.status(400).json({ error: 'Message is too long (max 4000 characters)' });

    const partnerRes = await query(
      'SELECT first_name, last_name FROM partners WHERE id = $1',
      [id]
    );
    const partnerRow = partnerRes.rows[0];
    const senderName = `${partnerRow?.first_name || ''} ${partnerRow?.last_name || ''}`.trim() || 'Partner';

    const insert = await query(
      `INSERT INTO partner_support_messages (partner_id, sender_role, sender_username, message, is_from_superadmin)
       VALUES ($1, 'partner', $2, $3, false)
       RETURNING id, sender_role, sender_username, message, is_from_superadmin, read_at, created_at`,
      [id, senderName, message]
    );
    const messageRow = insert.rows[0];
    void emitPartnerSupportMessage(id, messageRow);
    return res.status(201).json({ message: messageRow });
  } catch (error) {
    console.error('Partner support message post error:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

router.put('/support/read', authenticatePartner, async (req: PartnerAuthRequest, res) => {
  try {
    const id = req.partner!.partnerId;
    await query(
      `UPDATE partner_support_messages SET read_at = NOW()
        WHERE partner_id = $1 AND is_from_superadmin = true AND read_at IS NULL AND is_deleted = false`,
      [id]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Partner support read error:', error);
    return res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

export default router;
