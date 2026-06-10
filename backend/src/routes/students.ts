import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

// Configure multer for memory storage (Base64)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit for Base64

const router = express.Router();

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

/** Last graduated class + date when class_assigned_id was cleared on graduation. */
const STUDENT_SELECT_FIELDS = `
  s.*,
  COALESCE(c.class_name, gc.class_name) AS class_name,
  COALESCE(c.level, gc.level) AS level,
  c.stream,
  COALESCE(c.id, gc.class_id) AS resolved_class_id,
  gc.graduated_at
`;

const STUDENT_FROM_JOINS = `
  FROM students s
  LEFT JOIN classes c ON s.class_assigned_id = c.id
  LEFT JOIN LATERAL (
    SELECT cl.class_name, cl.level, cl.id AS class_id, gd.graduated_at
    FROM graduation_details gd
    JOIN classes cl ON cl.id = gd.class_id
    WHERE gd.student_id = s.id AND gd.tenant_id = s.tenant_id
    ORDER BY gd.graduated_at DESC, gd.id DESC
    LIMIT 1
  ) gc ON true
`;

// Get all students
// Default: active students only
// ?status=inactive: inactive students
// ?status=graduated: alumni only
// ?status=all: all students
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { classId } = req.query;
    const statusParam = String(req.query.status || 'active').toLowerCase();
    const status = ['active', 'inactive', 'all', 'graduated'].includes(statusParam) ? statusParam : 'active';

    let queryText = `
      SELECT ${STUDENT_SELECT_FIELDS}
      ${STUDENT_FROM_JOINS}
      WHERE s.tenant_id = $1
        AND ($2::text = 'all' OR COALESCE(s.enrollment_status, 'active') = $2)
    `;
    const params: any[] = [tenantId, status];

    if (classId) {
      queryText += ` AND s.class_assigned_id = $${params.length + 1}`;
      params.push(classId);
    }

    queryText += ' ORDER BY s.created_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get single student
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;

    const result = await query(
      `SELECT ${STUDENT_SELECT_FIELDS}
       ${STUDENT_FROM_JOINS}
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// Create student
router.post('/', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const studentData = req.body;

    // Generate student ID and admission number using a single count query for this tenant.
    const year = new Date().getFullYear();
    const yearShort = year.toString().slice(-2);
    const countRes = await query(
      'SELECT COUNT(*) AS total FROM students WHERE tenant_id = $1',
      [tenantId]
    );
    const count = parseInt(countRes.rows[0]?.total || '0', 10) + 1;
    const studentId = `${year}${count.toString().padStart(4, '0')}`;
    const admissionNumber = `ADM${yearShort}${count.toString().padStart(3, '0')}`;

    const result = await query(
      `INSERT INTO students (
        tenant_id, first_name, last_name, gender, date_of_birth, nationality,
        student_id, admission_number, class_assigned_id, guardian_name,
        guardian_contact, home_address, number_of_siblings, names_of_siblings,
        previous_school, date_of_admission, notes, passport_photo_url,
        is_beneficiary, beneficiary_type, discount_type, discount_value, beneficiary_notes,
        enrollment_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, 'active'
      ) RETURNING *`,
      [
        tenantId,
        studentData.first_name,
        studentData.last_name,
        studentData.gender || null,
        studentData.date_of_birth || null,
        studentData.nationality || null,
        studentId,
        admissionNumber,
        studentData.class_assigned_id || null,
        studentData.guardian_name || null,
        studentData.guardian_contact || null,
        studentData.home_address || null,
        studentData.number_of_siblings || 0,
        studentData.names_of_siblings || null,
        studentData.previous_school || null,
        studentData.date_of_admission || null,
        studentData.notes || null,
        studentData.passport_photo_url || null,
        studentData.is_beneficiary || false,
        studentData.beneficiary_type || null,
        studentData.discount_type || null,
        studentData.discount_value || 0,
        studentData.beneficiary_notes || null,
      ]
    );

    // Log creation
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'CREATE', 'STUDENT', result.rows[0].id]
    );
    emitTenantDataChanged(tenantId, 'student', 'created');

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Create student error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Student ID or admission number already exists' });
    }
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// Upload student passport photo
router.post('/:id/photo', requireRole('super-admin', 'administrator'), upload.single('photo'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Convert to Base64
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const result = await query(
      'UPDATE students SET passport_photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [base64Image, id, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Upload student photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Update student
router.put('/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const updates = req.body;

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const allowedFields = [
      'first_name', 'last_name', 'gender', 'date_of_birth', 'nationality',
      'class_assigned_id', 'guardian_name', 'guardian_contact', 'home_address',
      'number_of_siblings', 'names_of_siblings', 'previous_school',
      'date_of_admission', 'notes', 'passport_photo_url',
      'is_beneficiary', 'beneficiary_type', 'discount_type', 'discount_value', 'beneficiary_notes',
      'enrollment_status',
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
      `UPDATE students SET ${updateFields.join(', ')} WHERE tenant_id = $${paramCount} AND id = $${paramCount + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Log update
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, req.user!.id, 'UPDATE', 'STUDENT', parseInt(id)]
    );
    emitTenantDataChanged(tenantId, 'student', 'updated');

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Set student enrollment status (soft inactive / reactivate — never delete)
router.patch('/:id/status', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or inactive' });
    }

    const result = await query(
      'UPDATE students SET enrollment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [status, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const auditAction = status === 'inactive' ? 'DEACTIVATE' : 'REACTIVATE';
    await query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [tenantId, req.user!.id, auditAction, 'STUDENT', parseInt(id), JSON.stringify({ enrollment_status: status })]
    );
    emitTenantDataChanged(tenantId, 'student', 'updated');

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update student status error:', error);
    res.status(500).json({ error: 'Failed to update student status' });
  }
});

// Promote student
router.post('/:id/promote', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { new_class_id, current_term, academic_year } = req.body;

    if (!new_class_id) {
      return res.status(400).json({ error: 'New class ID is required' });
    }

    // Get current class
    const studentResult = await query(
      'SELECT class_assigned_id FROM students WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const oldClassId = studentResult.rows[0].class_assigned_id;

    const client = await (await import('../db/connection.js')).getClient();

    try {
      await client.query('BEGIN');

      // Update student class
      const result = await client.query(
        'UPDATE students SET class_assigned_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *',
        [new_class_id, id, tenantId]
      );

      // Fee carryover (outstanding→arrears, credit→student_credits) is handled by
      // processFeesForClassPromotion API, called by frontend BEFORE promote.

      await client.query('COMMIT');

      // Log promotion
      await query(
        'INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
        [tenantId, req.user!.id, 'PROMOTE', 'STUDENT', parseInt(id), JSON.stringify({ new_class_id, old_class_id: oldClassId })]
      );

      res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Promote student error:', error);
    res.status(500).json({ error: 'Failed to promote student' });
  }
});

export default router;
