import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, requireRole, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { authenticateParent, ParentAuthRequest } from '../middleware/authenticateParent.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from '../services/auditService.js';

const router = express.Router();

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

// ── Parent routes (authenticated via parent JWT) ──────────────────────────

// POST /api/student-checkins/process — Parent scans school QR to check in/out
router.post('/process', authenticateParent, async (req: ParentAuthRequest, res) => {
  try {
    const parent = req.parent!;
    const tenantId = parent.tenantId;
    const parentAccountId = parent.accountId;
    const { action, studentIds } = req.body;

    if (!action || !['check_in', 'check_out'].includes(action)) {
      res.status(400).json({ error: 'Action must be check_in or check_out' });
      return;
    }

    // Get the parent's own student + any linked students via family group
    let targetStudentIds: number[] = [];

    const accountRes = await query(
      'SELECT student_id FROM parent_portal_accounts WHERE id = $1 AND tenant_id = $2 AND is_active = true',
      [parentAccountId, tenantId]
    );
    if (accountRes.rows.length > 0) {
      targetStudentIds.push(Number(accountRes.rows[0].student_id));
    }

    // Get family group siblings
    const famRes = await query(
      `SELECT ppa.student_id FROM parent_portal_accounts ppa
       WHERE ppa.tenant_id = $1 AND ppa.family_group_id = (
         SELECT family_group_id FROM parent_portal_accounts WHERE id = $2 AND tenant_id = $1
       ) AND ppa.is_active = true AND ppa.id != $2`,
      [tenantId, parentAccountId]
    );
    for (const row of famRes.rows) {
      targetStudentIds.push(Number(row.student_id));
    }

    // If specific studentIds provided, filter to only those the parent has access to
    if (Array.isArray(studentIds) && studentIds.length > 0) {
      const filtered = studentIds
        .map((id: unknown) => parseInt(String(id), 10))
        .filter((id: number) => Number.isFinite(id) && id > 0 && targetStudentIds.includes(id));
      if (filtered.length === 0) {
        res.status(400).json({ error: 'None of the selected students are linked to your account' });
        return;
      }
      targetStudentIds = filtered;
    }

    // Filter to only opted-in students
    const enabledRes = await query(
      'SELECT id FROM students WHERE tenant_id = $1 AND id = ANY($2) AND is_checkin_enabled = true',
      [tenantId, targetStudentIds]
    );
    const enabledIds = enabledRes.rows.map((r) => Number(r.id));
    if (enabledIds.length === 0) {
      res.status(400).json({ error: 'No opted-in students found. Enable check-in for your child in settings.' });
      return;
    }

    // Check: for check_in, student shouldn't already be checked in today without checking out
    // For check_out, student must be currently checked in
    for (const studentId of enabledIds) {
      const lastActionRes = await query(
        `SELECT action FROM student_check_ins
         WHERE tenant_id = $1 AND student_id = $2
           AND action_time::date = CURRENT_DATE
         ORDER BY action_time DESC
         LIMIT 1`,
        [tenantId, studentId]
      );

      if (action === 'check_in') {
        if (lastActionRes.rows.length > 0 && lastActionRes.rows[0].action === 'check_in') {
          continue; // Already checked in today, skip
        }
      } else {
        if (lastActionRes.rows.length === 0 || lastActionRes.rows[0].action !== 'check_in') {
          continue; // Not checked in today, can't check out
        }
      }

      await query(
        `INSERT INTO student_check_ins (tenant_id, student_id, action, action_time, performed_by_type, performed_by_id, method)
         VALUES ($1, $2, $3, NOW(), 'parent', $4, 'qr_scan')`,
        [tenantId, studentId, action, parentAccountId]
      );
    }

    emitTenantDataChanged(tenantId, 'checkin', 'created');

    const studentNames = await query(
      `SELECT id, first_name, last_name FROM students
       WHERE tenant_id = $1 AND id = ANY($2)`,
      [tenantId, enabledIds]
    );

    res.json({
      success: true,
      message: `${action === 'check_in' ? 'Check-in' : 'Check-out'} recorded for ${studentNames.rows.length} student(s)`,
      students: studentNames.rows.map((r) => ({
        id: Number(r.id),
        name: `${r.first_name} ${r.last_name}`,
      })),
    });
  } catch (error) {
    console.error('Process checkin error:', error);
    res.status(500).json({ error: 'Failed to process check-in/out' });
  }
});

// GET /api/student-checkins/status?classId=X — Current campus status (admin/staff)
router.get('/status', authenticate, requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const classId = req.query.classId ? String(req.query.classId) : null;

    let params: any[] = [tenantId];
    let classFilter = '';
    if (classId) {
      classFilter = ' AND s.class_assigned_id = $2';
      params.push(classId);
    }

    // Get all opted-in students with their latest check-in status today
    const result = await query(
      `SELECT s.id, s.first_name, s.last_name, s.student_id, s.admission_number,
              c.class_name, c.id AS class_id,
              sci.action AS last_action,
              sci.action_time::text AS last_action_time,
              sci.performed_by_type AS last_action_by_type,
              CASE
                WHEN sci.action IS NULL THEN 'no_record'
                WHEN sci.action = 'check_in' AND (sci2.action IS NULL OR sci2.action_time < sci.action_time) THEN 'on_campus'
                ELSE 'off_campus'
              END AS current_status
       FROM students s
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       LEFT JOIN LATERAL (
         SELECT action, action_time, performed_by_type
         FROM student_check_ins
         WHERE student_id = s.id AND tenant_id = s.tenant_id
           AND action_time::date = CURRENT_DATE
         ORDER BY action_time DESC
         LIMIT 1
       ) sci ON true
       LEFT JOIN LATERAL (
         SELECT action, action_time
         FROM student_check_ins
         WHERE student_id = s.id AND tenant_id = s.tenant_id
           AND action_time::date = CURRENT_DATE AND action = 'check_out'
         ORDER BY action_time DESC
         LIMIT 1
       ) sci2 ON true
       WHERE s.tenant_id = $1 AND s.is_checkin_enabled = true
         AND COALESCE(s.enrollment_status, 'active') = 'active'
       ${classFilter}
       ORDER BY s.first_name, s.last_name`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get checkin status error:', error);
    res.status(500).json({ error: 'Failed to fetch check-in status' });
  }
});

// GET /api/student-checkins/student/:studentId — History for a specific student (parent or admin)
router.get('/student/:studentId', authenticate, requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { studentId } = req.params;

    const result = await query(
      `SELECT sci.id, sci.action, sci.action_time::text AS action_time,
              sci.performed_by_type, sci.method, sci.notes, sci.created_at::text AS created_at
       FROM student_check_ins sci
       WHERE sci.tenant_id = $1 AND sci.student_id = $2
       ORDER BY sci.action_time DESC
       LIMIT 50`,
      [tenantId, studentId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get student checkin history error:', error);
    res.status(500).json({ error: 'Failed to fetch check-in history' });
  }
});

// GET /api/student-checkins/history — Full paginated history (admin)
router.get('/history', authenticate, requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const offset = (page - 1) * limit;
    const date = req.query.date ? String(req.query.date) : null;
    const classId = req.query.classId ? String(req.query.classId) : null;

    const conditions = ['sci.tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (date) {
      conditions.push(`sci.action_time::date = $${paramIdx++}`);
      params.push(date);
    }
    if (classId) {
      conditions.push(`s.class_assigned_id = $${paramIdx++}`);
      params.push(classId);
    }

    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM student_check_ins sci
       JOIN students s ON sci.student_id = s.id AND s.tenant_id = sci.tenant_id
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    const result = await query(
      `SELECT sci.id, sci.action, sci.action_time::text AS action_time,
              sci.performed_by_type, sci.method, sci.notes,
              s.id AS student_db_id, s.first_name, s.last_name, s.student_id, s.admission_number,
              c.class_name
       FROM student_check_ins sci
       JOIN students s ON sci.student_id = s.id AND s.tenant_id = sci.tenant_id
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sci.action_time DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    );

    res.json({
      items: result.rows,
      total: countResult.rows[0]?.total || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Get checkin history error:', error);
    res.status(500).json({ error: 'Failed to fetch check-in history' });
  }
});

// ── Staff routes (authenticated via staff JWT) ────────────────────────────

// POST /api/student-checkins/manual — Staff manually checks in/out a student
router.post('/manual', authenticate, requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { studentId, action, notes } = req.body;

    if (!studentId || !action || !['check_in', 'check_out'].includes(action)) {
      res.status(400).json({ error: 'studentId and action (check_in/check_out) are required' });
      return;
    }

    // Verify student exists and is checkin-enabled
    const studentRes = await query(
      'SELECT id, first_name, last_name, is_checkin_enabled FROM students WHERE id = $1 AND tenant_id = $2',
      [studentId, tenantId]
    );
    if (studentRes.rows.length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    if (!studentRes.rows[0].is_checkin_enabled) {
      res.status(400).json({ error: 'Student has not been opted into check-in tracking' });
      return;
    }

    await query(
      `INSERT INTO student_check_ins (tenant_id, student_id, action, action_time, performed_by_type, performed_by_id, method, notes)
       VALUES ($1, $2, $3, NOW(), 'staff', $4, 'manual', $5)`,
      [tenantId, studentId, action, userId, notes || null]
    );

    const student = studentRes.rows[0];
    void writeAuditLog({
      tenantId,
      userId,
      userRole,
      action: action === 'check_in' ? 'CHECKIN_MANUAL' : 'CHECKOUT_MANUAL',
      entityType: 'CHECKIN',
      entityId: Number(studentId),
      module: 'checkin',
      summary: `Manual ${action === 'check_in' ? 'check-in' : 'check-out'} for ${student.first_name} ${student.last_name}`,
    });

    emitTenantDataChanged(tenantId, 'checkin', 'created');

    res.json({
      success: true,
      message: `${student.first_name} ${student.last_name} ${action === 'check_in' ? 'checked in' : 'checked out'} successfully`,
    });
  } catch (error) {
    console.error('Manual checkin error:', error);
    res.status(500).json({ error: 'Failed to record check-in/out' });
  }
});

// ── Parent-only routes (authenticated via parent JWT, no staff auth required) ──

// GET /api/student-checkins/my-status — Get current check-in status for parent's children
router.get('/my-status', authenticateParent, async (req: ParentAuthRequest, res) => {
  try {
    const parent = req.parent!;
    const tenantId = parent.tenantId;

    const result = await query(
      `SELECT s.id, s.first_name, s.last_name, s.student_id, s.is_checkin_enabled,
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
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [parent.studentId, tenantId]
    );

    // Also get linked accounts
    const linkedRes = await query(
      `SELECT s.id, s.first_name, s.last_name, s.student_id, s.is_checkin_enabled,
              c.class_name,
              sci.action AS last_action,
              sci.action_time::text AS last_action_time
       FROM parent_portal_accounts ppa
       JOIN students s ON ppa.student_id = s.id AND ppa.tenant_id = s.tenant_id
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       LEFT JOIN LATERAL (
         SELECT action, action_time
         FROM student_check_ins
         WHERE student_id = s.id AND tenant_id = s.tenant_id
           AND action_time::date = CURRENT_DATE
         ORDER BY action_time DESC
         LIMIT 1
       ) sci ON true
       WHERE ppa.tenant_id = $1 AND ppa.family_group_id = (
         SELECT family_group_id FROM parent_portal_accounts WHERE id = $2 AND tenant_id = $1
       ) AND ppa.id != $2 AND ppa.is_active = true`,
      [tenantId, parent.accountId]
    );

    const allStudents = [...result.rows, ...linkedRes.rows];
    res.json(allStudents);
  } catch (error) {
    console.error('Get my status error:', error);
    res.status(500).json({ error: 'Failed to fetch check-in status' });
  }
});

// GET /api/student-checkins/qr-content — Admin gets the QR code URLs for printing (require admin)
router.get('/qr-content', authenticate, requireTenant, setTenantContext, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;

    const tenantRes = await query(
      'SELECT slug, subdomain FROM tenants WHERE id = $1',
      [tenantId]
    );
    if (tenantRes.rows.length === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const { slug, subdomain } = tenantRes.rows[0];
    const tenantSlug = slug || subdomain || '';
    const origin = (req.headers['origin'] || req.headers['referer'] || '') as string;
    const isLocalDev = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('lvh.me');

    let baseUrl: string;
    let checkInUrl: string;
    let checkOutUrl: string;

    if (isLocalDev) {
      const parsed = new URL(origin);
      const port = parsed.port ? `:${parsed.port}` : '';
      baseUrl = `http://${tenantSlug}.lvh.me${port}`;
      checkInUrl = `${baseUrl}/checkin?action=check_in`;
      checkOutUrl = `${baseUrl}/checkin?action=check_out`;
    } else if (subdomain) {
      baseUrl = `https://${subdomain}.scholarnerve.com`;
      checkInUrl = `${baseUrl}/checkin?action=check_in`;
      checkOutUrl = `${baseUrl}/checkin?action=check_out`;
    } else {
      baseUrl = `https://scholarnerve.com/school/${slug}`;
      checkInUrl = `${baseUrl}/checkin?action=check_in`;
      checkOutUrl = `${baseUrl}/checkin?action=check_out`;
    }

    res.json({ checkInUrl, checkOutUrl, baseUrl });
  } catch (error) {
    console.error('Get QR content error:', error);
    res.status(500).json({ error: 'Failed to get QR code content' });
  }
});

// PATCH /api/student-checkins/opt-in — Parent toggles is_checkin_enabled for their child
router.patch('/opt-in', authenticateParent, async (req: ParentAuthRequest, res) => {
  try {
    const parent = req.parent!;
    const { enabled, studentId } = req.body;

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }

    const targetId = studentId || parent.studentId;
    if (!targetId) {
      res.status(400).json({ error: 'No student specified' });
      return;
    }

    // Verify this parent is linked to the target student
    const linkRes = await query(
      `SELECT 1 FROM parent_portal_accounts ppa
       JOIN students s ON s.id = $1 AND s.tenant_id = $2
       WHERE ppa.tenant_id = $2 AND ppa.is_active = true
         AND (ppa.id = $3 OR ppa.student_id = $1
           OR ppa.family_group_id = (SELECT family_group_id FROM parent_portal_accounts WHERE id = $3 AND tenant_id = $2))
       LIMIT 1`,
      [targetId, parent.tenantId, parent.accountId]
    );

    if (linkRes.rows.length === 0) {
      res.status(403).json({ error: 'You are not linked to this student' });
      return;
    }

    await query(
      'UPDATE students SET is_checkin_enabled = $1 WHERE id = $2 AND tenant_id = $3',
      [enabled, targetId, parent.tenantId]
    );

    res.json({ message: `Check-in ${enabled ? 'enabled' : 'disabled'}` });
  } catch (error) {
    console.error('Toggle opt-in error:', error);
    res.status(500).json({ error: 'Failed to update check-in setting' });
  }
});

export default router;
