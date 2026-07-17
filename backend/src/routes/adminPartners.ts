import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import {
  ensureMonthlyCommissions,
  generatePartnerPublicId,
  recalcPartnerTier,
  upsertPartnerCommission,
} from '../services/partnerService.js';
import { notifyPartner } from '../services/partnerNotifyService.js';
import { sendPartnerEmail, sendPartnerEmailBatch, previewPartnerEmail } from '../services/partnerEmailService.js';

const router = express.Router();

router.use(authenticate, requireRole('super-admin'));

const LEAD_STATUSES = ['new', 'contacted', 'demo_booked', 'converted', 'dead'];

// ---------------------------------------------------------------------------
// GET /api/admin/partners — applications + management list
// ---------------------------------------------------------------------------
router.get('/', async (req: AuthRequest, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;

    const conditions: string[] = [];
    const params: any[] = [];
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }
    if (search) {
      params.push(search);
      conditions.push(
        `(p.first_name || ' ' || p.last_name ILIKE $${params.length}
          OR p.phone ILIKE $${params.length}
          OR p.email ILIKE $${params.length}
          OR p.partner_id ILIKE $${params.length})`
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT p.*,
              (SELECT COUNT(*)::int FROM partner_school_leads l WHERE l.partner_id = p.id) AS total_leads,
              (SELECT COUNT(*)::int FROM partner_school_leads l WHERE l.partner_id = p.id AND l.status = 'converted') AS converted_leads,
              COALESCE((SELECT SUM(c.commission_amount) FROM partner_commissions c WHERE c.partner_id = p.id AND c.status = 'paid'), 0) AS total_paid,
              COALESCE((SELECT SUM(c.commission_amount) FROM partner_commissions c WHERE c.partner_id = p.id AND c.status = 'pending'), 0) AS total_pending
         FROM partners p
         ${where}
         ORDER BY p.created_at DESC`,
      params
    );
    return res.json({ partners: result.rows });
  } catch (error) {
    console.error('Admin partners list error:', error);
    return res.status(500).json({ error: 'Failed to load partners' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/partners/leads — all partner-submitted leads
// (declared before /:id so "leads" isn't captured as an id)
// ---------------------------------------------------------------------------
router.get('/leads', async (req: AuthRequest, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const params: any[] = [];
    let where = '';
    if (status && LEAD_STATUSES.includes(status)) {
      params.push(status);
      where = `WHERE l.status = $1`;
    }
    const result = await query(
      `SELECT l.*, p.first_name, p.last_name, p.partner_id AS partner_public_id
         FROM partner_school_leads l
         JOIN partners p ON p.id = l.partner_id
         ${where}
         ORDER BY l.created_at DESC`,
      params
    );
    return res.json({ leads: result.rows });
  } catch (error) {
    console.error('Admin partner leads error:', error);
    return res.status(500).json({ error: 'Failed to load leads' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/partners/leads/:id/status — inline status editing.
// Converting requires linking a tenant + plan amount; creates first commission
// and recalculates the partner's tier.
// ---------------------------------------------------------------------------
router.put('/leads/:id/status', async (req: AuthRequest, res) => {
  try {
    const leadId = parseInt(req.params.id, 10);
    const { status, convertedSchoolId, planAmount, commissionRate, notes, demoMeetingUrl } = req.body || {};
    if (!LEAD_STATUSES.includes(String(status))) {
      return res.status(400).json({ error: 'Invalid lead status' });
    }

    const leadRes = await query('SELECT * FROM partner_school_leads WHERE id = $1', [leadId]);
    if (leadRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const lead = leadRes.rows[0];

    const meetingUrl = String(demoMeetingUrl || '').trim() || null;
    if (status === 'demo_booked' && !meetingUrl) {
      return res.status(400).json({ error: 'Add a demo meeting link (Google Meet, Zoom, etc.) when booking the demo' });
    }

    if (status === 'converted') {
      const plan = Number(planAmount);
      if (!plan || plan <= 0) {
        return res.status(400).json({ error: 'Set the monthly plan amount to convert this lead' });
      }
      const rate = Number(commissionRate) > 0 ? Number(commissionRate) : 30;
      await query(
        `UPDATE partner_school_leads SET
           status = 'converted',
           converted_school_id = $1,
           converted_at = COALESCE(converted_at, NOW()),
           plan_amount = $2,
           commission_rate = $3,
           notes = COALESCE($4, notes),
           updated_at = NOW()
         WHERE id = $5`,
        [convertedSchoolId ? Number(convertedSchoolId) : null, plan, rate, notes || null, leadId]
      );
      await ensureMonthlyCommissions(Number(lead.partner_id));
      await recalcPartnerTier(Number(lead.partner_id));
    } else {
      await query(
        `UPDATE partner_school_leads SET
           status = $1,
           notes = COALESCE($2, notes),
           demo_meeting_url = COALESCE($3, demo_meeting_url),
           updated_at = NOW()
         WHERE id = $4`,
        [status, notes || null, meetingUrl, leadId]
      );
      if (lead.status === 'converted') {
        await recalcPartnerTier(Number(lead.partner_id));
      }
      if (meetingUrl && meetingUrl !== lead.demo_meeting_url) {
        await notifyPartner(
          Number(lead.partner_id),
          'Demo link ready',
          `The demo meeting link for ${lead.school_name} is ready. Open My Schools to view and join.`,
          '/schools',
        );
      }
    }

    const updated = await query(
      `SELECT l.*, p.first_name, p.last_name, p.partner_id AS partner_public_id
         FROM partner_school_leads l JOIN partners p ON p.id = l.partner_id
        WHERE l.id = $1`,
      [leadId]
    );
    return res.json({ lead: updated.rows[0] });
  } catch (error) {
    console.error('Admin lead status error:', error);
    return res.status(500).json({ error: 'Failed to update lead status' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/partners/commissions — overview grouped per partner
// ---------------------------------------------------------------------------
router.get('/commissions', async (req: AuthRequest, res) => {
  try {
    await ensureMonthlyCommissions();
    const now = new Date();

    const [summaryRes, pendingByPartnerRes, recordsRes] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(commission_amount) FILTER (WHERE month = $1 AND year = $2), 0) AS this_month,
           COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0) AS total_paid,
           COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0) AS total_pending
         FROM partner_commissions`,
        [now.getMonth() + 1, now.getFullYear()]
      ),
      query(
        `SELECT p.id AS partner_db_id, p.first_name, p.last_name, p.partner_id AS partner_public_id,
                COUNT(DISTINCT c.lead_id)::int AS schools_count,
                COALESCE(SUM(c.commission_amount), 0) AS total_pending
           FROM partner_commissions c
           JOIN partners p ON p.id = c.partner_id
          WHERE c.status = 'pending'
          GROUP BY p.id, p.first_name, p.last_name, p.partner_id
          ORDER BY total_pending DESC`
      ),
      query(
        `SELECT c.*, l.school_name, p.first_name, p.last_name, p.partner_id AS partner_public_id
           FROM partner_commissions c
           LEFT JOIN partner_school_leads l ON l.id = c.lead_id
           JOIN partners p ON p.id = c.partner_id
          ORDER BY c.year DESC, c.month DESC, c.id DESC
          LIMIT 500`
      ),
    ]);

    return res.json({
      summary: {
        thisMonth: Number(summaryRes.rows[0].this_month),
        totalPaid: Number(summaryRes.rows[0].total_paid),
        totalPending: Number(summaryRes.rows[0].total_pending),
      },
      pendingByPartner: pendingByPartnerRes.rows,
      records: recordsRes.rows,
    });
  } catch (error) {
    console.error('Admin commissions error:', error);
    return res.status(500).json({ error: 'Failed to load commissions' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/partners/commissions/:id — adjust pending commission (rate/plan)
// Updates partner dashboard after save + sends notification.
// ---------------------------------------------------------------------------
router.put('/commissions/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { planAmount, commissionRate, commissionAmount } = req.body || {};

    const commRes = await query('SELECT * FROM partner_commissions WHERE id = $1', [id]);
    if (commRes.rows.length === 0) {
      return res.status(404).json({ error: 'Commission not found' });
    }
    const comm = commRes.rows[0];
    if (comm.status === 'paid') {
      return res.status(400).json({ error: 'Paid commissions cannot be adjusted' });
    }

    const plan = planAmount !== undefined ? Number(planAmount) : Number(comm.plan_amount);
    const rate = commissionRate !== undefined ? Number(commissionRate) : Number(comm.commission_rate);
    if (!plan || plan <= 0) {
      return res.status(400).json({ error: 'Plan amount must be greater than zero' });
    }
    if (!rate || rate <= 0 || rate > 100) {
      return res.status(400).json({ error: 'Commission rate must be between 1 and 100' });
    }
    const amount =
      commissionAmount !== undefined && commissionAmount !== null
        ? Number(commissionAmount)
        : Math.round(plan * rate) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Commission amount must be greater than zero' });
    }

    const updated = await query(
      `UPDATE partner_commissions
          SET plan_amount = $1, commission_rate = $2, commission_amount = $3
        WHERE id = $4
        RETURNING *`,
      [plan, rate, amount, id]
    );

    if (comm.lead_id) {
      await query(
        `UPDATE partner_school_leads SET plan_amount = $1, commission_rate = $2, updated_at = NOW()
          WHERE id = $3`,
        [plan, rate, comm.lead_id]
      );
    }

    await notifyPartner(
      comm.partner_id,
      'Commission updated',
      `A commission record was updated: ${rate}% on GHS ${plan.toLocaleString('en-GH')}/mo (GHS ${amount.toLocaleString('en-GH')} this month).`
    );

    return res.json({ commission: updated.rows[0] });
  } catch (error) {
    console.error('Admin adjust commission error:', error);
    return res.status(500).json({ error: 'Failed to adjust commission' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/partners/commissions — record commission for a specific month
// Body: { partnerId, leadId, month, year, planAmount, commissionRate, commissionAmount? }
// ---------------------------------------------------------------------------
router.post('/commissions', async (req: AuthRequest, res) => {
  try {
    const { partnerId, leadId, month, year, planAmount, commissionRate, commissionAmount } = req.body || {};
    const pId = Number(partnerId);
    const lId = Number(leadId);
    const m = Number(month);
    const y = Number(year);
    const plan = Number(planAmount);
    const rate = Number(commissionRate);

    if (!pId || !lId || !m || !y) {
      return res.status(400).json({ error: 'Partner, school lead, month and year are required' });
    }
    if (m < 1 || m > 12) {
      return res.status(400).json({ error: 'Month must be between 1 and 12' });
    }
    if (!plan || plan <= 0) {
      return res.status(400).json({ error: 'Plan amount must be greater than zero' });
    }
    if (!rate || rate <= 0 || rate > 100) {
      return res.status(400).json({ error: 'Commission rate must be between 1 and 100' });
    }

    const commission = await upsertPartnerCommission({
      partnerDbId: pId,
      leadId: lId,
      month: m,
      year: y,
      planAmount: plan,
      commissionRate: rate,
      commissionAmount: commissionAmount !== undefined ? Number(commissionAmount) : undefined,
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    await notifyPartner(
      pId,
      'Commission recorded',
      `A ${monthNames[m - 1]} ${y} commission of GHS ${Number(commission.commission_amount).toLocaleString('en-GH')} was added to your dashboard.`
    );

    return res.status(201).json({ commission });
  } catch (error: any) {
    console.error('Admin create partner commission error:', error);
    return res.status(400).json({ error: error?.message || 'Failed to create commission' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/partners/commissions/:id/pay — single or bulk mark-paid.
// Body: { momoReference, bulkPartnerId? } — bulkPartnerId pays all pending
// commissions for that partner in one go.
// ---------------------------------------------------------------------------
router.put('/commissions/:id/pay', async (req: AuthRequest, res) => {
  try {
    const { momoReference, bulkPartnerId } = req.body || {};
    const reference = String(momoReference || '').trim();
    if (!reference) {
      return res.status(400).json({ error: 'Enter the MoMo reference number' });
    }

    let updated;
    if (bulkPartnerId) {
      updated = await query(
        `UPDATE partner_commissions
            SET status = 'paid', paid_at = NOW(), momo_reference = $1
          WHERE partner_id = $2 AND status = 'pending'
          RETURNING id`,
        [reference, Number(bulkPartnerId)]
      );
    } else {
      updated = await query(
        `UPDATE partner_commissions
            SET status = 'paid', paid_at = NOW(), momo_reference = $1
          WHERE id = $2 AND status = 'pending'
          RETURNING id, partner_id`,
        [reference, parseInt(req.params.id, 10)]
      );
    }

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'No pending commission found to pay' });
    }

    const partnerDbId = bulkPartnerId
      ? Number(bulkPartnerId)
      : Number(updated.rows[0].partner_id);
    await notifyPartner(
      partnerDbId,
      'Commission paid 🎉',
      `Your commission payout has been sent to your MoMo. Reference: ${reference}.`
    );

    return res.json({ success: true, paidCount: updated.rows.length });
  } catch (error) {
    console.error('Admin pay commission error:', error);
    return res.status(500).json({ error: 'Failed to mark commission as paid' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/partners/notifications — compose to all/approved/specific
// ---------------------------------------------------------------------------
router.post('/notifications', async (req: AuthRequest, res) => {
  try {
    const { title, body, audience, partnerDbId } = req.body || {};
    if (!String(title || '').trim() || !String(body || '').trim()) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    let recipients;
    if (audience === 'specific') {
      if (!partnerDbId) return res.status(400).json({ error: 'Select a partner' });
      recipients = await query('SELECT id FROM partners WHERE id = $1', [Number(partnerDbId)]);
    } else if (audience === 'approved') {
      recipients = await query(`SELECT id FROM partners WHERE status = 'approved'`);
    } else {
      recipients = await query(`SELECT id FROM partners WHERE status <> 'rejected'`);
    }

    for (const row of recipients.rows) {
      await notifyPartner(
        Number(row.id),
        String(title).trim(),
        String(body).trim()
      );
    }
    return res.json({ success: true, recipientCount: recipients.rows.length });
  } catch (error) {
    console.error('Admin partner notification error:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/partners/notifications — sent history (grouped by batch)
// ---------------------------------------------------------------------------
router.get('/notifications', async (_req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT title, body, MIN(created_at) AS sent_at, COUNT(*)::int AS recipient_count
         FROM partner_notifications
        GROUP BY title, body
        ORDER BY MIN(created_at) DESC
        LIMIT 100`
    );
    return res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Admin partner notifications history error:', error);
    return res.status(500).json({ error: 'Failed to load notification history' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/partners/emails — send branded email to partners
// ---------------------------------------------------------------------------
router.post('/emails', async (req: AuthRequest, res) => {
  try {
    const { template, audience, partnerDbId, note, subject, body } = req.body || {};
    const tpl = String(template || 'custom') as
      | 'application_received'
      | 'approved'
      | 'suspended'
      | 'restored'
      | 'rejected'
      | 'custom';

    const allowed = ['application_received', 'approved', 'suspended', 'restored', 'rejected', 'custom'];
    if (!allowed.includes(tpl)) {
      return res.status(400).json({ error: 'Invalid email template' });
    }

    const aud = String(audience || 'approved');
    if (!['all', 'approved', 'pending', 'suspended', 'specific'].includes(aud)) {
      return res.status(400).json({ error: 'Invalid audience' });
    }
    if (aud === 'specific' && !partnerDbId) {
      return res.status(400).json({ error: 'Select a partner' });
    }
    if (tpl === 'custom' && (!String(subject || '').trim() || !String(body || '').trim())) {
      return res.status(400).json({ error: 'Subject and message are required for custom emails' });
    }
    if (tpl === 'suspended' && !String(note || '').trim()) {
      return res.status(400).json({ error: 'Include a suspension reason for this template' });
    }

    const result = await sendPartnerEmailBatch({
      template: tpl,
      audience: aud,
      partnerDbId: partnerDbId ? Number(partnerDbId) : undefined,
      note: String(note || '').trim() || undefined,
      customSubject: String(subject || '').trim() || undefined,
      customBody: String(body || '').trim() || undefined,
      req,
    });

    return res.json({
      success: true,
      sentCount: result.sentCount,
      recipientCount: result.recipientCount,
    });
  } catch (error) {
    console.error('Admin partner email error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/partners/emails/preview — live template preview for admin UI
// ---------------------------------------------------------------------------
router.post('/emails/preview', async (req: AuthRequest, res) => {
  try {
    const { template, note, subject, body, partnerDbId } = req.body || {};
    const tpl = String(template || 'approved') as
      | 'application_received'
      | 'approved'
      | 'suspended'
      | 'restored'
      | 'rejected'
      | 'custom';

    let sampleFirstName = 'Kofi';
    let samplePartnerId: string | null = 'SN-453-12';
    if (partnerDbId) {
      const p = await query('SELECT first_name, partner_id FROM partners WHERE id = $1', [Number(partnerDbId)]);
      if (p.rows[0]) {
        sampleFirstName = String(p.rows[0].first_name || sampleFirstName);
        samplePartnerId = p.rows[0].partner_id ? String(p.rows[0].partner_id) : null;
      }
    }

    const preview = await previewPartnerEmail({
      template: tpl,
      note: String(note || '').trim() || undefined,
      customSubject: String(subject || '').trim() || undefined,
      customBody: String(body || '').trim() || undefined,
      sampleFirstName,
      samplePartnerId,
      req,
    });

    return res.json(preview);
  } catch (error) {
    console.error('Admin partner email preview error:', error);
    return res.status(500).json({ error: 'Failed to build email preview' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/partners/emails — sent email history (grouped by batch)
// ---------------------------------------------------------------------------
router.get('/emails', async (_req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT template, subject, body_preview, batch_id,
              MIN(sent_at) AS sent_at, COUNT(*)::int AS recipient_count
         FROM partner_emails
        GROUP BY template, subject, body_preview, batch_id
        ORDER BY MIN(sent_at) DESC
        LIMIT 100`
    );
    return res.json({ emails: result.rows });
  } catch (error) {
    console.error('Admin partner emails history error:', error);
    return res.status(500).json({ error: 'Failed to load email history' });
  }
});

// ---------------------------------------------------------------------------
// Training videos
// ---------------------------------------------------------------------------
router.get('/training-videos', async (_req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT v.*,
              (SELECT COUNT(*)::int FROM partner_video_progress p WHERE p.video_id = v.id) AS watch_count
         FROM partner_training_videos v
        ORDER BY v.created_at DESC`
    );
    return res.json({ videos: result.rows });
  } catch (error) {
    console.error('Admin partner videos error:', error);
    return res.status(500).json({ error: 'Failed to load videos' });
  }
});

router.post('/training-videos', async (req: AuthRequest, res) => {
  try {
    const { youtubeUrl, title, description } = req.body || {};
    if (!String(youtubeUrl || '').trim() || !String(title || '').trim()) {
      return res.status(400).json({ error: 'YouTube URL and title are required' });
    }
    const inserted = await query(
      `INSERT INTO partner_training_videos (youtube_url, title, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [String(youtubeUrl).trim(), String(title).trim(), String(description || '').trim() || null]
    );
    return res.status(201).json({ video: inserted.rows[0] });
  } catch (error) {
    console.error('Admin add partner video error:', error);
    return res.status(500).json({ error: 'Failed to add video' });
  }
});

router.delete('/training-videos/:id', async (req: AuthRequest, res) => {
  try {
    await query('DELETE FROM partner_training_videos WHERE id = $1', [
      parseInt(req.params.id, 10),
    ]);
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin delete partner video error:', error);
    return res.status(500).json({ error: 'Failed to delete video' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/partners/:id — detail with leads + commissions
// ---------------------------------------------------------------------------
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid partner id' });

    const partnerRes = await query('SELECT * FROM partners WHERE id = $1', [id]);
    if (partnerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    const [leadsRes, commissionsRes] = await Promise.all([
      query(
        `SELECT * FROM partner_school_leads WHERE partner_id = $1 ORDER BY created_at DESC`,
        [id]
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

    return res.json({
      partner: partnerRes.rows[0],
      leads: leadsRes.rows,
      commissions: commissionsRes.rows,
    });
  } catch (error) {
    console.error('Admin partner detail error:', error);
    return res.status(500).json({ error: 'Failed to load partner' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/partners/:id/approve — assign SN-XXX-XX + notify
// ---------------------------------------------------------------------------
router.put('/:id/approve', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const partnerRes = await query('SELECT * FROM partners WHERE id = $1', [id]);
    if (partnerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    const partner = partnerRes.rows[0];

    if (partner.status === 'suspended') {
      return res.status(400).json({ error: 'Partner is suspended — use Unsuspend instead of Approve' });
    }

    const publicId = partner.partner_id || (await generatePartnerPublicId());
    const updated = await query(
      `UPDATE partners SET status = 'approved', partner_id = $1, rejection_note = NULL, updated_at = NOW()
        WHERE id = $2 RETURNING *`,
      [publicId, id]
    );

    await notifyPartner(
      id,
      'You are approved! 🎉',
      `Congratulations ${partner.first_name}! Your ScholarNerve Partner application has been approved. Your Partner ID is ${publicId}. Start referring schools and earning monthly commissions from your dashboard.`,
      '/',
    );

    sendPartnerEmail(updated.rows[0], 'approved', { partnerId: publicId }, undefined, req).catch(() => undefined);

    return res.json({ partner: updated.rows[0] });
  } catch (error) {
    console.error('Admin approve partner error:', error);
    return res.status(500).json({ error: 'Failed to approve partner' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/partners/:id/reject — optional note + notify
// ---------------------------------------------------------------------------
router.put('/:id/reject', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const note = String(req.body?.note || '').trim();

    const partnerRes = await query('SELECT * FROM partners WHERE id = $1', [id]);
    if (partnerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    const partner = partnerRes.rows[0];

    const updated = await query(
      `UPDATE partners SET status = 'rejected', rejection_note = $1, updated_at = NOW()
        WHERE id = $2 RETURNING *`,
      [note || null, id]
    );

    sendPartnerEmail(partner, 'rejected', { note: note || null }, undefined, req).catch(() => undefined);

    return res.json({ partner: updated.rows[0] });
  } catch (error) {
    console.error('Admin reject partner error:', error);
    return res.status(500).json({ error: 'Failed to reject partner' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/partners/:id/suspend — lock account + notify
// ---------------------------------------------------------------------------
router.put('/:id/suspend', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const note = String(req.body?.note || '').trim();

    const partnerRes = await query('SELECT * FROM partners WHERE id = $1', [id]);
    if (partnerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    const partner = partnerRes.rows[0];
    if (partner.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved partners can be suspended' });
    }

    const updated = await query(
      `UPDATE partners SET status = 'suspended', suspension_note = $1, updated_at = NOW()
        WHERE id = $2 RETURNING *`,
      [note || null, id]
    );

    await notifyPartner(
      id,
      'Account suspended',
      note
        ? `Your ScholarNerve Partner account has been suspended. Reason: ${note}. Contact support if you believe this is a mistake.`
        : 'Your ScholarNerve Partner account has been suspended. Contact the ScholarNerve team for assistance.'
    );

    sendPartnerEmail(partner, 'suspended', { note: note || null }, undefined, req).catch(() => undefined);

    return res.json({ partner: updated.rows[0] });
  } catch (error) {
    console.error('Admin suspend partner error:', error);
    return res.status(500).json({ error: 'Failed to suspend partner' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/partners/:id/unsuspend — restore approved access
// ---------------------------------------------------------------------------
router.put('/:id/unsuspend', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const note = String(req.body?.note || '').trim();

    const partnerRes = await query('SELECT * FROM partners WHERE id = $1', [id]);
    if (partnerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    const partner = partnerRes.rows[0];
    if (partner.status !== 'suspended') {
      return res.status(400).json({ error: 'Partner is not suspended' });
    }
    if (!partner.partner_id) {
      return res.status(400).json({ error: 'Partner has no public ID — approve first' });
    }

    const updated = await query(
      `UPDATE partners SET status = 'approved', suspension_note = NULL, restoration_note = $1, updated_at = NOW()
        WHERE id = $2 RETURNING *`,
      [note || null, id]
    );

    const unsuspendMessage = note
      ? `Your ScholarNerve Partner account has been unsuspended. Note from our team: ${note}. Continue referring schools and earning commissions from your dashboard.`
      : `Good news ${partner.first_name}! Your ScholarNerve Partner account has been unsuspended. Continue referring schools and earning commissions from your dashboard.`;

    await notifyPartner(id, 'Account unsuspended', unsuspendMessage);

    sendPartnerEmail(partner, 'restored', { note: note || null }, undefined, req).catch(() => undefined);

    return res.json({ partner: updated.rows[0] });
  } catch (error) {
    console.error('Admin unsuspend partner error:', error);
    return res.status(500).json({ error: 'Failed to restore partner' });
  }
});

export default router;
