import express from 'express';
import multer from 'multer';
import path from 'path';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { sendPushToTenantStaff } from '../services/webPushService.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import { resolveActorFromRequest, withActor } from '../utils/auditResolve.js';
import {
  suspendTeacher,
  deactivateTeacher,
  reactivateTeacher,
  normalizeTeacherStatus,
} from '../services/teacherStatusService.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import {
  buildLetterContent,
  saveAppointmentLetter,
  listAppointmentLetters,
  getAppointmentLetterPdf,
} from '../services/appointmentLetterService.js';
import { ensureTeacherUserAccount } from '../services/teacherUserService.js';
import { persistStaffProfileFields } from '../services/staffFieldSuggestionService.js';
import {
  assignTeacherSubjectClass,
  getTeacherSubjectClassesGrouped,
  removeTeacherSubjectClass,
  syncTeacherClassAssignments,
  syncTeacherSubjectClasses,
  type SubjectClassPair,
} from '../services/teacherSubjectClassService.js';

function generatePin(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

function stripTeacherPhotoForList(row: Record<string, unknown>) {
  const has = !!(row.passport_photo_url && String(row.passport_photo_url).length > 0);
  const { passport_photo_url, ...rest } = row;
  return { ...rest, has_passport_photo: has };
}

const ASSIGNED_CLASS_IDS_SQL = `
  COALESCE(
    (SELECT array_agg(ct.class_id ORDER BY ct.is_main DESC NULLS LAST, ct.class_id)
     FROM class_teachers ct
     WHERE ct.teacher_id = t.id AND ct.tenant_id = t.tenant_id),
    ARRAY[]::int[]
  ) AS assigned_class_ids
`;

const router = express.Router();

const emitTenantDataChanged = (
  tenantId: number,
  entity: string,
  action: 'created' | 'updated' | 'deleted',
  extra?: Record<string, unknown>
) => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity,
      action,
      at: Date.now(),
      ...(extra || {}),
    });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);

// Get current teacher profile
router.get('/me', async (req: AuthRequest, res) => {
  try {
    const teacherId = req.user!.teacherId;
    const role = req.user!.role;
    if (!teacherId || (role !== 'teacher' && role !== 'staff')) {
      return res.status(403).json({ error: 'Not a teacher account' });
    }
    const tenantId = req.user!.tenantId!;
    const result = await query(
      `SELECT t.*, c.class_name, c.level, c.stream
       FROM teachers t
       LEFT JOIN classes c ON t.class_assigned_id = c.id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [teacherId, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    const row = result.rows[0];
    const has = !!(row.passport_photo_url && String(row.passport_photo_url).length > 0);
    const { passport_photo_url, ...rest } = row;
    res.json({ ...rest, has_passport_photo: has });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get current teacher's classes (from class_teachers + main assignment)
router.get('/me/classes', async (req: AuthRequest, res) => {
  try {
    const teacherId = req.user!.teacherId;
    const role = req.user!.role;
    if (!teacherId || (role !== 'teacher' && role !== 'staff')) {
      return res.status(403).json({ error: 'Not a teacher account' });
    }
    const tenantId = req.user!.tenantId!;
    const result = await query(
      `SELECT DISTINCT c.id, c.class_name, c.level, c.stream,
         COALESCE(ct.is_main, (c.assigned_teacher_id = $1::int)) as is_main,
         (SELECT COUNT(*) FROM students s WHERE s.class_assigned_id = c.id AND s.tenant_id = $2 AND COALESCE(s.enrollment_status, 'active') = 'active') as student_count
       FROM classes c
       LEFT JOIN class_teachers ct ON ct.class_id = c.id AND ct.teacher_id = $1::int AND ct.tenant_id = $2
       WHERE c.tenant_id = $2
         AND (c.assigned_teacher_id = $1::int OR ct.teacher_id IS NOT NULL)
       ORDER BY c.level, c.stream`,
      [teacherId, tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get me classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Teacher portal: subject-class assignments (source of truth for scoped teaching)
router.get('/me/subject-classes', async (req: AuthRequest, res) => {
  try {
    const teacherId = req.user!.teacherId;
    const role = req.user!.role;
    if (!teacherId || (role !== 'teacher' && role !== 'staff')) {
      return res.status(403).json({ error: 'Not a teacher account' });
    }
    const tenantId = req.user!.tenantId!;
    const data = await getTeacherSubjectClassesGrouped(tenantId, Number(teacherId));
    res.json(data);
  } catch (error) {
    console.error('Get me subject-classes error:', error);
    res.status(500).json({ error: 'Failed to fetch subject-class assignments' });
  }
});

// Broadcast in-app notice to teachers and payroll staff (socket + bell / toast on client)
router.post(
  '/announce',
  requireRole('super-admin', 'administrator', 'finance'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const title = String(req.body?.title || 'Message from school').slice(0, 120);
      const body = String(req.body?.message || '').trim().slice(0, 800);
      if (!body) return res.status(400).json({ error: 'message is required' });
      emitTenantDataChanged(tenantId, 'school-staff-notice', 'created', { title, body });
      await sendPushToTenantStaff(tenantId, {
        title,
        body,
        url: `/school/${tenantId}`,
      }).catch(() => {});
      await query(
        'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, details) VALUES ($1, $2, $3, $4, $5)',
        [tenantId, req.user!.id, 'SCHOOL_STAFF_ANNOUNCE', 'TEACHERS_AND_STAFF', JSON.stringify({ title, bodyLen: body.length })],
      ).catch(() => {});
      return res.json({ success: true });
    } catch (error) {
      console.error('Teacher announce error:', error);
      return res.status(500).json({ error: 'Failed to send notice' });
    }
  }
);

// Display name for classes: junction (Assign Class tab) + legacy teachers.class_assigned_id
const TEACHER_CLASS_NAME_SQL = `
  COALESCE(
    NULLIF((
      SELECT STRING_AGG(DISTINCT cl.class_name, ', ' ORDER BY cl.class_name)
      FROM class_teachers ct2
      JOIN classes cl ON cl.id = ct2.class_id AND cl.tenant_id = ct2.tenant_id
      WHERE ct2.teacher_id = t.id AND ct2.tenant_id = t.tenant_id
    ), ''),
    c.class_name
  ) AS class_name
`;

// Get all teachers
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId } = req.query;

    let queryText = `
      SELECT t.*, ${TEACHER_CLASS_NAME_SQL.trim()},
        ${ASSIGNED_CLASS_IDS_SQL.trim()},
        c.level, c.stream
      FROM teachers t
      LEFT JOIN classes c ON t.class_assigned_id = c.id
      WHERE t.tenant_id = $1
        AND COALESCE(t.is_deleted, false) = false
    `;
    const params: any[] = [tenantId];

    if (classId) {
      queryText += ` AND (
        t.class_assigned_id = $2::int
        OR EXISTS (
          SELECT 1 FROM class_teachers ct3
          WHERE ct3.teacher_id = t.id AND ct3.class_id = $2::int AND ct3.tenant_id = t.tenant_id
        )
      )`;
      params.push(classId);
    }

    queryText += ' ORDER BY t.created_at DESC';

    let result;
    try {
      result = await query(queryText, params);
    } catch (e: any) {
      if (e?.code === '42P01') {
        queryText = `
          SELECT t.*, c.class_name, c.level, c.stream
          FROM teachers t
          LEFT JOIN classes c ON t.class_assigned_id = c.id
          WHERE t.tenant_id = $1
            AND COALESCE(t.is_deleted, false) = false
          ${classId ? ' AND t.class_assigned_id = $2' : ''}
          ORDER BY t.created_at DESC
        `;
        result = await query(queryText, classId ? [tenantId, classId] : [tenantId]);
      } else {
        throw e;
      }
    }
    res.json(result.rows.map(stripTeacherPhotoForList));
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// Teacher portal: own appointment letters
router.get('/me/appointment-letters', async (req: AuthRequest, res) => {
  try {
    const teacherId = req.user!.teacherId;
    const role = req.user!.role;
    if (!teacherId || (role !== 'teacher' && role !== 'staff')) {
      return res.status(403).json({ error: 'Not a teacher account' });
    }
    const rows = await listAppointmentLetters(req.user!.tenantId!, Number(teacherId));
    res.json(rows);
  } catch (error) {
    console.error('Get my appointment letters error:', error);
    res.status(500).json({ error: 'Failed to fetch appointment letters' });
  }
});

router.get('/me/appointment-letters/:letterId/download', async (req: AuthRequest, res) => {
  try {
    const teacherId = req.user!.teacherId;
    const role = req.user!.role;
    if (!teacherId || (role !== 'teacher' && role !== 'staff')) {
      return res.status(403).json({ error: 'Not a teacher account' });
    }
    const tenantId = req.user!.tenantId!;
    const letterId = parseInt(req.params.letterId, 10);
    const row = await getAppointmentLetterPdf(tenantId, Number(teacherId), letterId);
    if (!row) return res.status(404).json({ error: 'Letter not found' });

    let letterContent = row.letter_content as Record<string, any> | null;
    if (letterContent && typeof letterContent === 'object') {
      const teacherRes = await query(
        'SELECT passport_photo_url, signature FROM teachers WHERE id = $1 AND tenant_id = $2',
        [Number(teacherId), tenantId]
      );
      const photoUrl = teacherRes.rows[0]?.passport_photo_url || null;
      const signature = teacherRes.rows[0]?.signature || null;
      letterContent = {
        ...letterContent,
        teacher: {
          ...(letterContent.teacher || {}),
          id: Number(teacherId),
          photoUrl: letterContent.teacher?.photoUrl || photoUrl,
          signature: signature || letterContent.teacher?.signature,
        },
      };
    }

    res.json({
      id: row.id,
      version_number: row.version_number,
      reference_number: row.reference_number,
      pdf_data: row.pdf_data,
      letter_content: letterContent,
    });
  } catch (error) {
    console.error('Download my appointment letter error:', error);
    res.status(500).json({ error: 'Failed to download letter' });
  }
});

// Get teacher passport photo (lazy-loaded)
router.get('/:id/photo', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const result = await query(
      'SELECT passport_photo_url FROM teachers WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    res.json({ passport_photo_url: result.rows[0].passport_photo_url || null });
  } catch (error) {
    console.error('Get teacher photo error:', error);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

// Upload teacher passport photo
router.post(
  '/:id/photo',
  requireRole('super-admin', 'administrator'),
  upload.single('photo'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      const before = await query(
        'SELECT full_name, passport_photo_url FROM teachers WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      if (before.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });

      const result = await query(
        'UPDATE teachers SET passport_photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING id, full_name',
        [base64Image, id, tenantId]
      );

      await writeAuditLog({
        tenantId,
        userId: req.user!.id,
        userRole: req.user!.role,
        action: 'TEACHER_PHOTO_UPDATED',
        entityType: 'TEACHER',
        entityId: parseInt(id, 10),
        module: 'teachers',
        summary: `Updated passport photo for ${before.rows[0].full_name}`,
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || null,
      });
      emitTenantDataChanged(tenantId, 'teacher', 'updated');
      res.json({ id: result.rows[0].id, has_passport_photo: true });
    } catch (error) {
      console.error('Upload teacher photo error:', error);
      res.status(500).json({ error: 'Failed to upload photo' });
    }
  }
);

// Get teacher signature
router.get('/:id/signature', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const result = await query(
      'SELECT signature FROM teachers WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    res.json({ signature: result.rows[0].signature || null });
  } catch (error) {
    console.error('Get teacher signature error:', error);
    res.status(500).json({ error: 'Failed to fetch signature' });
  }
});

// Save teacher signature
router.put('/:id/signature', requireRole('super-admin', 'administrator', 'teacher'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { signature } = req.body;
    if (signature !== undefined && typeof signature !== 'string') {
      return res.status(400).json({ error: 'Signature must be a string (data URL)' });
    }
    const result = await query(
      'UPDATE teachers SET signature = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING id, full_name',
      [signature || null, id, tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });

    const before = await query(
      'SELECT full_name FROM teachers WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'TEACHER_SIGNATURE_UPDATED',
      entityType: 'TEACHER',
      entityId: parseInt(id, 10),
      module: 'teachers',
      summary: `Updated signature for ${before.rows[0]?.full_name || 'teacher'}`,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });
    emitTenantDataChanged(tenantId, 'teacher', 'updated');
    res.json({ id: result.rows[0].id, signature_updated: true });
  } catch (error) {
    console.error('Save teacher signature error:', error);
    res.status(500).json({ error: 'Failed to save signature' });
  }
});

// Get single teacher
router.get('/:id/status-history', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(teacherId)) {
      return res.status(400).json({ error: 'Invalid teacher id' });
    }

    const result = await query(
      `SELECT al.id, al.action, al.summary, al.details, al.before_values, al.after_values, al.created_at,
              COALESCE(NULLIF(TRIM(u.full_name), ''), u.username, 'System') AS performed_by
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.tenant_id = $1
         AND al.entity_type = 'TEACHER'
         AND al.entity_id = $2
         AND al.action IN ('TEACHER_SUSPENDED', 'TEACHER_DEACTIVATED', 'TEACHER_REACTIVATED', 'SOFT_DELETE')
       ORDER BY al.created_at DESC
       LIMIT 100`,
      [tenantId, teacherId]
    );

    const entries = result.rows.map((row: any) => {
      const details = typeof row.details === 'object' && row.details ? row.details : {};
      const before = typeof row.before_values === 'object' && row.before_values ? row.before_values : {};
      const after = typeof row.after_values === 'object' && row.after_values ? row.after_values : {};
      return {
        id: row.id,
        action: row.action,
        summary: row.summary,
        performedBy: row.performed_by,
        createdAt: row.created_at,
        reason: details.reason ?? null,
        notes: details.notes ?? null,
        suspensionStartDate: details.suspensionStartDate ?? null,
        suspensionEndDate: details.suspensionEndDate ?? null,
        effectiveDate: details.effectiveDate ?? null,
        previousStatus: details.previousStatus ?? before.status ?? null,
        previousClass: details.previousClass ?? before.class_name ?? null,
        newStatus: after.status ?? null,
      };
    });

    res.json({ entries });
  } catch (error) {
    console.error('Teacher status history error:', error);
    res.status(500).json({ error: 'Failed to load status history' });
  }
});

// Subject-class assignment endpoints (must be registered before GET /:id)
router.get('/:id/subject-classes', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = parseInt(req.params.id, 10);
    if (!Number.isFinite(teacherId)) return res.status(400).json({ error: 'Invalid teacher id' });

    const teacherCheck = await query(
      `SELECT id FROM teachers WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false`,
      [teacherId, tenantId]
    );
    if (teacherCheck.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });

    const data = await getTeacherSubjectClassesGrouped(tenantId, teacherId);
    res.json(data);
  } catch (error) {
    console.error('Get teacher subject-classes error:', error);
    res.status(500).json({ error: 'Failed to fetch subject-class assignments' });
  }
});

router.post(
  '/:id/subject-class',
  requireRole('super-admin', 'administrator'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const teacherId = parseInt(req.params.id, 10);
      const subjectId = parseInt(String(req.body?.subject_id), 10);
      const classId = parseInt(String(req.body?.class_id), 10);
      if (!Number.isFinite(teacherId) || !Number.isFinite(subjectId) || !Number.isFinite(classId)) {
        return res.status(400).json({ error: 'teacher id, subject_id, and class_id are required' });
      }
      await assignTeacherSubjectClass(tenantId, teacherId, subjectId, classId);
      emitTenantDataChanged(tenantId, 'teacher', 'updated');
      const data = await getTeacherSubjectClassesGrouped(tenantId, teacherId);
      res.json(data);
    } catch (error: any) {
      if (error?.status === 404) return res.status(404).json({ error: error.message });
      console.error('Assign subject-class error:', error);
      res.status(500).json({ error: 'Failed to assign subject to class' });
    }
  }
);

router.delete(
  '/:id/subject-class',
  requireRole('super-admin', 'administrator'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.user!.tenantId!;
      const teacherId = parseInt(req.params.id, 10);
      const subjectId = parseInt(String(req.body?.subject_id), 10);
      const classId = parseInt(String(req.body?.class_id), 10);
      if (!Number.isFinite(teacherId) || !Number.isFinite(subjectId) || !Number.isFinite(classId)) {
        return res.status(400).json({ error: 'teacher id, subject_id, and class_id are required' });
      }
      await removeTeacherSubjectClass(tenantId, teacherId, subjectId, classId);
      emitTenantDataChanged(tenantId, 'teacher', 'updated');
      const data = await getTeacherSubjectClassesGrouped(tenantId, teacherId);
      res.json(data);
    } catch (error) {
      console.error('Remove subject-class error:', error);
      res.status(500).json({ error: 'Failed to remove subject-class assignment' });
    }
  }
);

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    let result;
    try {
      result = await query(
        `SELECT t.*, ${TEACHER_CLASS_NAME_SQL.trim()},
           ${ASSIGNED_CLASS_IDS_SQL.trim()},
           c.level, c.stream
         FROM teachers t
         LEFT JOIN classes c ON t.class_assigned_id = c.id
         WHERE t.id = $1 AND t.tenant_id = $2`,
        [id, tenantId]
      );
    } catch (e: any) {
      if (e?.code === '42P01') {
        result = await query(
          `SELECT t.*, c.class_name, c.level, c.stream
           FROM teachers t
           LEFT JOIN classes c ON t.class_assigned_id = c.id
           WHERE t.id = $1 AND t.tenant_id = $2`,
          [id, tenantId]
        );
      } else {
        throw e;
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get teacher error:', error);
    res.status(500).json({ error: 'Failed to fetch teacher' });
  }
});

// Create teacher
router.post('/', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherData = req.body;
    
    // Generate staff ID
    const existingStaffIds = await query(
      'SELECT staff_id FROM teachers WHERE tenant_id = $1 AND staff_id LIKE $2',
      [tenantId, 'TCH%']
    );

    let staffId = 'TCH001';
    if (existingStaffIds.rows.length > 0) {
      const maxId = Math.max(
        ...existingStaffIds.rows.map((r) => {
          const num = parseInt(r.staff_id.slice(3)) || 0;
          return num;
        })
      );
      staffId = `TCH${(maxId + 1).toString().padStart(3, '0')}`;
    }

    const result = await query(
      `INSERT INTO teachers (
        tenant_id, full_name, gender, date_of_birth, staff_id, phone_number,
        email, address, subjects_taught, class_assigned_id, employment_date,
        monthly_salary, employment_status, notes, position, department,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        bank_name, bank_account_number, bank_branch, bank_account_name
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23
      ) RETURNING *`,
      [
        tenantId,
        teacherData.full_name,
        teacherData.gender || null,
        teacherData.date_of_birth || null,
        staffId,
        teacherData.phone_number || null,
        teacherData.email || null,
        teacherData.address || null,
        teacherData.subjects_taught || [],
        teacherData.class_assigned_id || null,
        teacherData.employment_date || null,
        teacherData.monthly_salary || null,
        teacherData.employment_status || 'Active',
        teacherData.notes || null,
        teacherData.position ? String(teacherData.position).trim() : null,
        teacherData.department ? String(teacherData.department).trim() : null,
        teacherData.emergency_contact_name || null,
        teacherData.emergency_contact_phone || null,
        teacherData.emergency_contact_relationship || null,
        teacherData.bank_name || null,
        teacherData.bank_account_number || null,
        teacherData.bank_branch || null,
        teacherData.bank_account_name || null,
      ]
    );

    await persistStaffProfileFields(
      tenantId,
      teacherData.position,
      teacherData.department
    ).catch(() => undefined);
    
    const teacherId = result.rows[0].id;
    const created = result.rows[0];

    if (Array.isArray(teacherData.subject_class_assignments) && teacherData.subject_class_assignments.length > 0) {
      await syncTeacherSubjectClasses(
        tenantId,
        teacherId,
        teacherData.subject_class_assignments as SubjectClassPair[]
      );
    } else if (Array.isArray(teacherData.class_ids) && teacherData.class_ids.length > 0) {
      await syncTeacherClassAssignments(tenantId, teacherId, teacherData.class_ids);
    }

    await query(
      `UPDATE teachers SET status = 'active' WHERE id = $1 AND tenant_id = $2`,
      [teacherId, tenantId]
    ).catch(() => {});

    try {
      await ensureTeacherUserAccount(tenantId, {
        id: teacherId,
        staff_id: staffId,
        full_name: teacherData.full_name,
        email: teacherData.email || null,
      });
      emitTenantDataChanged(tenantId, 'user', 'created');
    } catch (userErr) {
      console.error('Teacher user account creation warning (teacher saved):', userErr);
    }

    try {
      const actor = await resolveActorFromRequest(req);
      await writeAuditLog({
        tenantId,
        userId: req.user!.id,
        userRole: req.user!.role,
        action: 'CREATE',
        entityType: 'TEACHER',
        entityId: teacherId,
        module: 'academics',
        summary: withActor(`Teacher added — ${teacherData.full_name} (${staffId}) — user account auto-created`, actor),
        details: { fullName: teacherData.full_name, staffId },
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') ?? null,
      });
    } catch (auditErr) {
      console.error('Teacher audit log warning:', auditErr);
    }

    try {
      emitTenantDataChanged(tenantId, 'teacher', 'created');
    } catch {
      /* noop */
    }

    try {
      const { ensureGeneratedIdCard } = await import('../services/idCardAutoService.js');
      await ensureGeneratedIdCard({
        tenantId,
        entityType: 'STAFF',
        entityId: Number(created.id),
        generatedAt: teacherData.date_of_appointment || created.created_at,
        generatedBy: null,
      });
    } catch (cardErr) {
      console.error('[create-teacher] Auto ID card failed:', cardErr);
    }

    res.status(201).json({
      id: created.id,
      staff_id: staffId,
      full_name: created.full_name,
      loginStaffId: staffId,
      loginPassword: staffId,
      loginMessage: `Teacher can login with Staff ID: ${staffId} and Password: ${staffId} (must change on first login)`,
    });
  } catch (error: any) {
    console.error('Create teacher error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Staff ID already exists' });
    }
    const detail = error?.message || 'Unknown error';
    res.status(500).json({ error: 'Failed to create teacher', detail });
  }
});

// Update teacher
router.put('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const updates = { ...req.body };
    const classIds = updates.class_ids;
    const subjectClassAssignments = updates.subject_class_assignments;
    delete updates.class_ids;
    delete updates.subject_class_assignments;

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const allowedFields = [
      'full_name', 'gender', 'date_of_birth', 'phone_number', 'email',
      'address', 'subjects_taught', 'class_assigned_id', 'employment_date',
      'monthly_salary', 'employment_status', 'notes', 'position', 'department',
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
      'bank_name', 'bank_account_number', 'bank_branch', 'bank_account_name',
    ];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        const val = updates[field];
        values.push(
          (field === 'date_of_birth' || field === 'employment_date') && val === '' ? null : val
        );
        paramCount++;
      }
    }
    
    if (updateFields.length === 0 && classIds === undefined && subjectClassAssignments === undefined) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    let row: Record<string, unknown> | null = null;

    if (updateFields.length > 0) {
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(tenantId, id);

      const result = await query(
        `UPDATE teachers SET ${updateFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Teacher not found' });
      }
      row = result.rows[0];
    } else {
      const existing = await query(`SELECT * FROM teachers WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Teacher not found' });
      }
      row = existing.rows[0];
    }

    if (subjectClassAssignments !== undefined) {
      await syncTeacherSubjectClasses(
        tenantId,
        Number(id),
        subjectClassAssignments as SubjectClassPair[]
      );
      const refreshed = await query(`SELECT * FROM teachers WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
      row = refreshed.rows[0];
    } else if (classIds !== undefined) {
      await syncTeacherClassAssignments(tenantId, Number(id), classIds);
      const refreshed = await query(`SELECT * FROM teachers WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
      row = refreshed.rows[0];
    }

    await persistStaffProfileFields(
      tenantId,
      updates.position,
      updates.department
    ).catch(() => undefined);

    await query(
      `UPDATE users
       SET full_name = $1, email = $2, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $3 AND teacher_id::text = $4::text`,
      [row!.full_name, row!.email || null, tenantId, id]
    ).catch(() => {});

    try {
      await ensureTeacherUserAccount(tenantId, {
        id: Number(id),
        staff_id: String(row!.staff_id ?? ''),
        full_name: String(row!.full_name ?? ''),
        email: row!.email != null && String(row!.email).trim() !== '' ? String(row!.email) : null,
      });
    } catch {
      /* teacher saved; user link best-effort */
    }

    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'TEACHER',
      entityId: parseInt(id, 10),
      module: 'academics',
      summary: withActor(`Teacher profile updated — ${row!.full_name}`, actor),
      details: { fullName: row!.full_name, staffId: row!.staff_id },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    emitTenantDataChanged(tenantId, 'teacher', 'updated');

    res.json(row);
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

router.post('/:id/suspend', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = parseInt(req.params.id, 10);
    const { reason, suspension_start_date, suspension_end_date, notes } = req.body;
    if (!reason?.trim() || !suspension_start_date) {
      return res.status(400).json({ error: 'Reason and suspension start date are required' });
    }
    const row = await suspendTeacher({
      tenantId,
      teacherId,
      userId: req.user!.id,
      userRole: req.user!.role,
      reason: String(reason).trim(),
      suspensionStartDate: String(suspension_start_date),
      suspensionEndDate: suspension_end_date ? String(suspension_end_date) : null,
      notes: notes ? String(notes) : undefined,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });
    emitTenantDataChanged(tenantId, 'teacher', 'updated');
    res.json(stripTeacherPhotoForList(row));
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to suspend teacher' });
  }
});

router.post('/:id/deactivate', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = parseInt(req.params.id, 10);
    const { reason, effective_date, notes } = req.body;
    if (!reason?.trim() || !effective_date) {
      return res.status(400).json({ error: 'Reason and effective date are required' });
    }
    const result = await deactivateTeacher({
      tenantId,
      teacherId,
      userId: req.user!.id,
      userRole: req.user!.role,
      reason: String(reason).trim(),
      effectiveDate: String(effective_date),
      notes: notes ? String(notes) : undefined,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });
    emitTenantDataChanged(tenantId, 'teacher', 'updated');
    emitTenantDataChanged(tenantId, 'class', 'updated');
    res.json({
      teacher: stripTeacherPhotoForList(result.teacher),
      notification: result.previousClassName
        ? `Teacher ${result.teacher.full_name} has been deactivated. Class ${result.previousClassName} needs a new teacher assigned.`
        : `Teacher ${result.teacher.full_name} has been deactivated.`,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to deactivate teacher' });
  }
});

router.post('/:id/reactivate', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    if (!reason?.trim()) {
      return res.status(400).json({ error: 'Reactivation reason is required' });
    }
    const row = await reactivateTeacher({
      tenantId,
      teacherId,
      userId: req.user!.id,
      userRole: req.user!.role,
      reason: String(reason).trim(),
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });
    emitTenantDataChanged(tenantId, 'teacher', 'updated');
    res.json(stripTeacherPhotoForList(row));
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to reactivate teacher' });
  }
});

router.get('/:id/appointment-letters/checklist', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = parseInt(req.params.id, 10);
    const built = await buildLetterContent(tenantId, teacherId);
    res.json(built);
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate appointment letter prerequisites' });
  }
});

router.get('/:id/appointment-letters', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = parseInt(req.params.id, 10);
    const role = req.user!.role;
    if (role === 'teacher' || role === 'staff') {
      if (Number(req.user!.teacherId) !== teacherId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (!['super-admin', 'administrator'].includes(role || '')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const rows = await listAppointmentLetters(tenantId, teacherId);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list appointment letters' });
  }
});

router.post('/:id/appointment-letters', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = parseInt(req.params.id, 10);
    const built = await buildLetterContent(tenantId, teacherId);
    if (!built.ready || !built.letter) {
      return res.status(400).json({ error: 'Prerequisites not met', checklist: built.checklist });
    }
    const letterContent = req.body?.letter_content || built.letter;
    const pdfData = req.body?.pdf_data || null;
    const saved = await saveAppointmentLetter({
      tenantId,
      teacherId,
      userId: req.user!.id,
      userRole: req.user!.role,
      letterContent,
      pdfData,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });
    res.status(201).json(saved);
  } catch (error) {
    console.error('Save appointment letter error:', error);
    res.status(500).json({ error: 'Failed to save appointment letter' });
  }
});

router.get('/:id/appointment-letters/:letterId/download', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = parseInt(req.params.id, 10);
    const letterId = parseInt(req.params.letterId, 10);
    const role = req.user!.role;
    if (role === 'teacher' || role === 'staff') {
      if (Number(req.user!.teacherId) !== teacherId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (!['super-admin', 'administrator'].includes(role || '')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const row = await getAppointmentLetterPdf(tenantId, teacherId, letterId);
    if (!row) return res.status(404).json({ error: 'Letter not found' });

    let letterContent = row.letter_content as Record<string, any> | null;
    if (letterContent && typeof letterContent === 'object') {
      const teacherRes = await query(
        'SELECT passport_photo_url, signature FROM teachers WHERE id = $1 AND tenant_id = $2',
        [teacherId, tenantId]
      );
      const photoUrl = teacherRes.rows[0]?.passport_photo_url || null;
      const signature = teacherRes.rows[0]?.signature || null;
      letterContent = {
        ...letterContent,
        teacher: {
          ...(letterContent.teacher || {}),
          id: teacherId,
          photoUrl: letterContent.teacher?.photoUrl || photoUrl,
          signature: signature || letterContent.teacher?.signature,
        },
      };
    }

    res.json({
      id: row.id,
      version_number: row.version_number,
      reference_number: row.reference_number,
      pdf_data: row.pdf_data,
      letter_content: letterContent,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to download letter' });
  }
});

// Soft delete — hides from active lists; salary/payment history preserved
router.delete('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const teacherId = parseInt(req.params.id, 10);
    const reason = String(req.body?.reason || 'Removed from active staff list').trim();

    const existing = await query(
      'SELECT id, full_name, staff_id, COALESCE(is_deleted, false) AS is_deleted FROM teachers WHERE id = $1 AND tenant_id = $2',
      [teacherId, tenantId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    if (existing.rows[0].is_deleted) {
      return res.status(400).json({ error: 'Teacher is already removed' });
    }

    await query('DELETE FROM class_teachers WHERE teacher_id = $1 AND tenant_id = $2', [teacherId, tenantId]);
    await query('DELETE FROM teacher_subject_classes WHERE teacher_id = $1 AND tenant_id = $2', [
      teacherId,
      tenantId,
    ]).catch(() => undefined);
    await query(
      'UPDATE classes SET assigned_teacher_id = NULL WHERE assigned_teacher_id = $1 AND tenant_id = $2',
      [teacherId, tenantId]
    );
    await query(
      `UPDATE teachers
       SET is_deleted = true,
           status = 'deactivated',
           class_assigned_id = NULL,
           deactivation_date = CURRENT_DATE,
           deactivation_reason = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, full_name, staff_id`,
      [teacherId, tenantId, reason]
    );

    await query(
      `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $1 AND teacher_id::text = $2::text`,
      [tenantId, String(teacherId)]
    ).catch(() => undefined);

    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'SOFT_DELETE',
      entityType: 'TEACHER',
      entityId: teacherId,
      module: 'academics',
      summary: withActor(
        `Teacher soft-deleted — ${existing.rows[0].full_name} (${existing.rows[0].staff_id}). Salary history preserved.`,
        actor
      ),
      details: { reason, staffId: existing.rows[0].staff_id },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });

    emitTenantDataChanged(tenantId, 'teacher', 'deleted');
    emitTenantDataChanged(tenantId, 'user', 'updated');
    res.json({
      message: 'Teacher removed from active lists. All salary and payment records are preserved.',
      id: teacherId,
    });
  } catch (error) {
    console.error('Soft delete teacher error:', error);
    res.status(500).json({ error: 'Failed to remove teacher' });
  }
});

export default router;
