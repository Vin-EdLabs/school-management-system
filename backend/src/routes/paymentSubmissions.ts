import express, { Response } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { authenticateParent, ParentAuthRequest } from '../middleware/authenticateParent.js';
import { setTenantContext } from '../middleware/tenant.js';
import {
  notifyFinanceStaffOfPaymentSubmission,
  notifyParentOfSubmissionReview,
} from '../services/paymentSubmissionNotifyService.js';
import { getIO } from '../socket.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PAYMENT_PROOF_UPLOAD_DIR = path.join(__dirname, '../../uploads/payment-proofs');

const NETWORKS = ['MTN MoMo', 'Vodafone Cash', 'AirtelTigo', 'Bank Transfer'] as const;
const STATUSES = ['pending', 'reviewed', 'rejected'] as const;

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for payment proof screenshots'));
    }
  },
});

const financeRoles = requireRole('super-admin', 'administrator', 'finance');

function emitTenantDataChanged(tenantId: number) {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: 'payment-submission',
      action: 'updated',
      at: Date.now(),
    });
  } catch {
    /* socket optional */
  }
}

async function parentCanAccessStudent(
  tenantId: number,
  parentAccountId: number,
  studentId: number
): Promise<boolean> {
  const direct = await query(
    `SELECT 1 FROM parent_portal_accounts
     WHERE id = $1 AND tenant_id = $2 AND student_id = $3 AND is_active = true
     LIMIT 1`,
    [parentAccountId, tenantId, studentId]
  );
  if (direct.rows.length > 0) return true;

  const row = await query(
    `SELECT 1
     FROM parent_portal_accounts pa
     JOIN parent_portal_accounts sibling
       ON sibling.tenant_id = pa.tenant_id
      AND sibling.family_group_id IS NOT NULL
      AND sibling.family_group_id = pa.family_group_id
      AND sibling.is_active = true
     WHERE pa.id = $1
       AND pa.tenant_id = $2
       AND sibling.student_id = $3
     LIMIT 1`,
    [parentAccountId, tenantId, studentId]
  );
  return row.rows.length > 0;
}

function mapSubmissionRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    parentUserId: row.parent_user_id,
    amountClaimed: Number(row.amount_claimed),
    networkUsed: row.network_used,
    transactionReference: row.transaction_reference,
    screenshotUrl: row.screenshot_url,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    notes: row.notes,
    studentName: row.student_name,
    studentIdLabel: row.student_id_label,
    className: row.class_name,
    parentName: row.parent_name,
    reviewedByName: row.reviewed_by_name,
  };
}

/** GET /api/payment-submissions/payment-details — parent read-only school payment info */
router.get('/payment-details', authenticateParent, async (req: ParentAuthRequest, res: Response) => {
  try {
    const tenantId = req.parent!.tenantId;
    const result = await query(
      `SELECT mtn_momo_number, vodafone_cash_number, airteltigo_number, merchant_id,
              bank_name, bank_account_number, bank_account_name, payment_instructions
       FROM school_payment_settings
       WHERE tenant_id = $1`,
      [tenantId]
    );
    const row = result.rows[0] || {};
    res.json({
      mtnMomoNumber: row.mtn_momo_number || '',
      vodafoneCashNumber: row.vodafone_cash_number || '',
      airteltigoNumber: row.airteltigo_number || '',
      merchantId: row.merchant_id || '',
      bankName: row.bank_name || '',
      bankAccountNumber: row.bank_account_number || '',
      bankAccountName: row.bank_account_name || '',
      paymentInstructions: row.payment_instructions || '',
    });
  } catch (error) {
    console.error('Get parent payment details error:', error);
    res.status(500).json({ error: 'Failed to load payment details' });
  }
});

/** POST /api/payment-submissions — parent submits payment proof */
router.post('/', authenticateParent, proofUpload.single('screenshot'), async (req: ParentAuthRequest, res: Response) => {
  try {
    const { accountId, tenantId } = req.parent!;
    const bodySchema = z.object({
      studentId: z.coerce.number().int().positive(),
      amountClaimed: z.coerce.number().positive(),
      networkUsed: z.enum(NETWORKS),
      transactionReference: z.string().max(255).optional(),
    });
    const parsed = bodySchema.parse(req.body);

    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'Payment screenshot is required' });
    }

    const allowed = await parentCanAccessStudent(tenantId, accountId, parsed.studentId);
    if (!allowed) {
      return res.status(403).json({ error: 'You cannot submit payment for this student' });
    }

    await fs.mkdir(PAYMENT_PROOF_UPLOAD_DIR, { recursive: true });
    const ext = path.extname(req.file.originalname || '').slice(0, 8).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext) ? ext : '.jpg';
    const filename = `${tenantId}-${parsed.studentId}-${Date.now()}${safeExt}`;
    await fs.writeFile(path.join(PAYMENT_PROOF_UPLOAD_DIR, filename), req.file.buffer);
    const screenshotUrl = `/uploads/payment-proofs/${filename}`;

    const insert = await query(
      `INSERT INTO payment_submissions (
         tenant_id, student_id, parent_user_id, amount_claimed, network_used,
         transaction_reference, screenshot_url, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [
        tenantId,
        parsed.studentId,
        accountId,
        parsed.amountClaimed,
        parsed.networkUsed,
        parsed.transactionReference?.trim() || null,
        screenshotUrl,
      ]
    );

    const studentRow = await query(
      `SELECT first_name, last_name FROM students WHERE id = $1 AND tenant_id = $2`,
      [parsed.studentId, tenantId]
    );
    const stu = studentRow.rows[0];
    const studentLabel = stu
      ? `${stu.first_name} ${stu.last_name}`.trim()
      : 'A student';

    await notifyFinanceStaffOfPaymentSubmission(tenantId, {
      title: 'New Payment Submission',
      body: `${studentLabel}: GHS ${parsed.amountClaimed.toFixed(2)} via ${parsed.networkUsed}. Review in Payment Submissions.`,
      url: '/?module=payment-submissions',
    });

    emitTenantDataChanged(tenantId);
    res.status(201).json(mapSubmissionRow(insert.rows[0]));
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid submission data' });
    }
    const err = error as { message?: string };
    console.error('Create payment submission error:', error);
    res.status(500).json({ error: err.message || 'Failed to submit payment proof' });
  }
});

/** GET /api/payment-submissions/my — parent's submission history */
router.get('/my', authenticateParent, async (req: ParentAuthRequest, res: Response) => {
  try {
    const { accountId, tenantId } = req.parent!;
    const rows = await query(
      `SELECT ps.*,
              s.first_name || ' ' || s.last_name AS student_name,
              s.student_id AS student_id_label,
              c.class_name
       FROM payment_submissions ps
       JOIN students s ON s.id = ps.student_id AND s.tenant_id = ps.tenant_id
       LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
       WHERE ps.tenant_id = $1 AND ps.parent_user_id = $2
       ORDER BY ps.submitted_at DESC
       LIMIT 100`,
      [tenantId, accountId]
    );
    res.json(rows.rows.map(mapSubmissionRow));
  } catch (error) {
    console.error('Get my payment submissions error:', error);
    res.status(500).json({ error: 'Failed to load submission history' });
  }
});

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

/** GET /api/payment-submissions — finance queue */
router.get('/', financeRoles, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const status = String(req.query.status || 'all').toLowerCase();
    const params: unknown[] = [tenantId];
    let where = 'ps.tenant_id = $1';
    if (status !== 'all' && (STATUSES as readonly string[]).includes(status)) {
      params.push(status);
      where += ` AND ps.status = $${params.length}`;
    }

    const rows = await query(
      `SELECT ps.*,
              s.first_name || ' ' || s.last_name AS student_name,
              s.student_id AS student_id_label,
              c.class_name,
              COALESCE(NULLIF(TRIM(s.guardian_name), ''), s.first_name || ' ' || s.last_name) AS parent_name,
              u.full_name AS reviewed_by_name
       FROM payment_submissions ps
       JOIN students s ON s.id = ps.student_id AND s.tenant_id = ps.tenant_id
       LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
       LEFT JOIN users u ON u.id = ps.reviewed_by
       WHERE ${where}
       ORDER BY ps.submitted_at DESC
       LIMIT 500`,
      params
    );
    res.json(rows.rows.map(mapSubmissionRow));
  } catch (error) {
    console.error('List payment submissions error:', error);
    res.status(500).json({ error: 'Failed to load payment submissions' });
  }
});

/** PUT /api/payment-submissions/:id/status — review or reject */
router.put('/:id/status', financeRoles, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId!;
    const submissionId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(submissionId)) {
      return res.status(400).json({ error: 'Invalid submission id' });
    }

    const bodySchema = z.object({
      status: z.enum(['reviewed', 'rejected']),
      notes: z.string().max(2000).optional(),
    });
    const { status, notes } = bodySchema.parse(req.body);

    const existing = await query(
      `SELECT ps.*,
              s.first_name || ' ' || s.last_name AS student_name
       FROM payment_submissions ps
       JOIN students s ON s.id = ps.student_id
       WHERE ps.id = $1 AND ps.tenant_id = $2`,
      [submissionId, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    const row = existing.rows[0];
    if (row.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending submissions can be updated' });
    }

    const updated = await query(
      `UPDATE payment_submissions
       SET status = $1,
           reviewed_at = NOW(),
           reviewed_by = $2,
           notes = $3
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [status, req.user!.id, notes?.trim() || null, submissionId, tenantId]
    );

    const amount = Number(row.amount_claimed).toFixed(2);
    const studentName = String(row.student_name || 'Student').trim();

    if (status === 'reviewed') {
      await notifyParentOfSubmissionReview(Number(row.parent_user_id), {
        title: 'Payment Submission Reviewed',
        body: `Your GHS ${amount} payment for ${studentName} has been reviewed. Record your payment in fees if not already done.`,
        url: '?tab=finance&financeSub=make-payment',
      });
    } else {
      await notifyParentOfSubmissionReview(Number(row.parent_user_id), {
        title: 'Payment Submission Rejected',
        body: notes?.trim()
          ? `Your GHS ${amount} payment for ${studentName} was rejected: ${notes.trim().slice(0, 120)}`
          : `Your GHS ${amount} payment for ${studentName} was rejected. Contact the school for details.`,
        url: '?tab=finance&financeSub=make-payment',
      });
    }

    emitTenantDataChanged(tenantId);

    const full = await query(
      `SELECT ps.*,
              s.first_name || ' ' || s.last_name AS student_name,
              s.student_id AS student_id_label,
              c.class_name,
              COALESCE(NULLIF(TRIM(s.guardian_name), ''), s.first_name || ' ' || s.last_name) AS parent_name,
              u.full_name AS reviewed_by_name
       FROM payment_submissions ps
       JOIN students s ON s.id = ps.student_id AND s.tenant_id = ps.tenant_id
       LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
       LEFT JOIN users u ON u.id = ps.reviewed_by
       WHERE ps.id = $1`,
      [submissionId]
    );
    res.json(mapSubmissionRow(full.rows[0]));
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Update payment submission status error:', error);
    res.status(500).json({ error: err.message || 'Failed to update submission' });
  }
});

export default router;
