import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { sendPushToTenantStaff } from '../services/webPushService.js';

function generatePin(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

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

// Get current teacher profile (teacher role) - must be before /:id
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
    res.json(result.rows[0]);
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
         (SELECT COUNT(*) FROM students s WHERE s.class_assigned_id = c.id AND s.tenant_id = $2) as student_count
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
        c.level, c.stream
      FROM teachers t
      LEFT JOIN classes c ON t.class_assigned_id = c.id
      WHERE t.tenant_id = $1
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
          ${classId ? ' AND t.class_assigned_id = $2' : ''}
          ORDER BY t.created_at DESC
        `;
        result = await query(queryText, classId ? [tenantId, classId] : [tenantId]);
      } else {
        throw e;
      }
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// Get single teacher
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    let result;
    try {
      result = await query(
        `SELECT t.*, ${TEACHER_CLASS_NAME_SQL.trim()},
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
        ...existingStaffIds.rows.map(r => {
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
        monthly_salary, employment_status, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
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
        teacherData.employment_status || null,
        teacherData.notes || null,
      ]
    );
    
    const teacherId = result.rows[0].id;
    const loginPin = generatePin();
    const passwordHash = await bcrypt.hash(loginPin, 10);
    
    await query(
      `INSERT INTO users (tenant_id, username, full_name, email, password_hash, role, teacher_id)
       VALUES ($1, $2, $3, $4, $5, 'teacher', $6)`,
      [tenantId, staffId, teacherData.full_name, teacherData.email || null, passwordHash, String(teacherId)]
    );
    
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'CREATE', 'TEACHER', teacherId]
    );
    emitTenantDataChanged(tenantId, 'teacher', 'created');
    
    res.status(201).json({
      ...result.rows[0],
      loginStaffId: staffId,
      loginPin,
      loginMessage: `Teacher can login with Staff ID: ${staffId} and PIN: ${loginPin}`,
    });
  } catch (error: any) {
    console.error('Create teacher error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Staff ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create teacher' });
  }
});

// Update teacher
router.put('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const updates = req.body;
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    const allowedFields = [
      'full_name', 'gender', 'date_of_birth', 'phone_number', 'email',
      'address', 'subjects_taught', 'class_assigned_id', 'employment_date',
      'monthly_salary', 'employment_status', 'notes'
    ];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        values.push(updates[field]);
        paramCount++;
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(tenantId, id);
    
    const result = await query(
      `UPDATE teachers SET ${updateFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    await query(
      `UPDATE users
       SET full_name = $1, email = $2, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $3 AND teacher_id::text = $4::text`,
      [result.rows[0].full_name, result.rows[0].email || null, tenantId, id]
    ).catch(() => {});
    
    // Log update
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'UPDATE', 'TEACHER', parseInt(id)]
    );
    emitTenantDataChanged(tenantId, 'teacher', 'updated');
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

// Delete teacher
router.delete('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM teachers WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    // Log deletion
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'DELETE', 'TEACHER', parseInt(id)]
    );
    emitTenantDataChanged(tenantId, 'teacher', 'deleted');
    
    res.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    res.status(500).json({ error: 'Failed to delete teacher' });
  }
});

export default router;
