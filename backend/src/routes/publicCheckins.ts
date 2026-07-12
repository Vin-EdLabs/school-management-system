import express from 'express';
import { query } from '../db/connection.js';
import { resolveTenantBySlug } from '../services/tenantResolver.js';

const router = express.Router();

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

function resolveIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

async function resolveTenant(req: express.Request): Promise<{ id: number; slug: string } | null> {
  const slug = req.headers['x-tenant-slug'];
  if (typeof slug === 'string' && slug.trim()) {
    const tenant = await resolveTenantBySlug(slug.trim());
    if (tenant) return { id: tenant.id, slug: tenant.slug ?? '' };
  }
  return null;
}

// GET /api/public-checkins/lookup/:admissionNumber — Lookup student info by admission number
router.get('/lookup/:admissionNumber', async (req, res) => {
  const ip = resolveIp(req);
  if (!rateLimit(ip, 15)) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return;
  }

  try {
    const tenant = await resolveTenant(req);
    if (!tenant) {
      res.status(400).json({ error: 'School not recognised. Please scan the QR code at the school gate.' });
      return;
    }

    const { admissionNumber } = req.params;
    if (!admissionNumber?.trim()) {
      res.status(400).json({ error: 'Please enter a student ID.' });
      return;
    }

    const result = await query(
      `SELECT s.id, s.first_name, s.last_name, s.student_id, s.admission_number, s.is_checkin_enabled,
              c.class_name,
              sci.action AS last_action,
              sci.action_time::text AS last_action_time
       FROM students s
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       LEFT JOIN LATERAL (
         SELECT action, action_time
         FROM student_check_ins
         WHERE student_id = s.id AND tenant_id = s.tenant_id
           AND action_time::date = CURRENT_DATE
         ORDER BY action_time DESC
         LIMIT 1
       ) sci ON true
       WHERE (s.admission_number = $1 OR s.student_id = $1) AND s.tenant_id = $2`,
      [admissionNumber.trim(), tenant.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Student not found or check-in is not enabled for this student.' });
      return;
    }

    const student = result.rows[0];

    // Check if there are siblings in the same family group
    let siblings: Array<{ id: number; firstName: string; lastName: string; studentId: string; admissionNumber: string }> = [];
    try {
      const siblingsRes = await query(
        `SELECT s.id, s.first_name, s.last_name, s.student_id, s.admission_number
         FROM student_guardians sg
         JOIN students s ON s.id = sg.student_id AND s.tenant_id = sg.tenant_id
         WHERE sg.guardian_phone IN (
           SELECT guardian_phone FROM student_guardians
           WHERE student_id = $1 AND tenant_id = $2
         )
         AND s.id != $1 AND s.tenant_id = $2 AND s.is_checkin_enabled = true
         AND sg.is_active = true`,
        [student.id, tenant.id]
      );
      siblings = siblingsRes.rows.map((r: any) => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        studentId: r.student_id,
        admissionNumber: r.admission_number,
      }));
    } catch {
      // student_guardians table may not exist — siblings are optional
    }

    res.json({
      student: {
        id: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        studentId: student.student_id,
        admissionNumber: student.admission_number,
        className: student.class_name,
        isCheckinEnabled: student.is_checkin_enabled,
        lastAction: student.last_action,
        lastActionTime: student.last_action_time,
      },
      siblings,
    });
  } catch (error) {
    console.error('Student lookup error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/public-checkins/process — Process check-in/out from public QR scan
router.post('/process', async (req, res) => {
  const ip = resolveIp(req);
  if (!rateLimit(ip, 10)) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return;
  }

  try {
    const tenant = await resolveTenant(req);
    if (!tenant) {
      res.status(400).json({ error: 'School not recognised. Please scan the QR code at the school gate.' });
      return;
    }

    const { action, admissionNumber } = req.body;
    if (!action || !['check_in', 'check_out'].includes(action)) {
      res.status(400).json({ error: 'Invalid action. Please scan the correct QR code.' });
      return;
    }
    if (!admissionNumber?.trim()) {
      res.status(400).json({ error: 'Please enter a student ID.' });
      return;
    }

    // Find the student
    const studentRes = await query(
      'SELECT id, first_name, last_name, student_id, is_checkin_enabled FROM students WHERE (admission_number = $1 OR student_id = $1) AND tenant_id = $2',
      [admissionNumber.trim(), tenant.id]
    );
    if (studentRes.rows.length === 0) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    const student = studentRes.rows[0];

    if (!student.is_checkin_enabled) {
      res.status(400).json({ error: 'Check-in is not enabled for this student.' });
      return;
    }

    // Check for duplicate
    const lastRes = await query(
      `SELECT action FROM student_check_ins
       WHERE student_id = $1 AND tenant_id = $2
         AND action_time::date = CURRENT_DATE
       ORDER BY action_time DESC LIMIT 1`,
      [student.id, tenant.id]
    );

    if (lastRes.rows.length > 0 && lastRes.rows[0].action === action) {
      const label = action === 'check_in' ? 'already checked in' : 'already checked out';
      res.status(409).json({ error: `${student.first_name} ${student.last_name} is ${label} today.` });
      return;
    }

    // Record the check-in
    await query(
      `INSERT INTO student_check_ins (tenant_id, student_id, action, performed_by_type, performed_by_id, method)
       VALUES ($1, $2, $3, 'parent', 0, 'qr_scan')`,
      [tenant.id, student.id, action]
    );

    const actionLabel = action === 'check_in' ? 'Drop-off' : 'Pick-up';
    res.json({
      message: `${actionLabel} recorded for ${student.first_name} ${student.last_name}`,
      student: {
        id: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
      },
    });
  } catch (error) {
    console.error('Public check-in error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

export default router;
